import { expect, test, type Page } from '@playwright/test';
import type { GameService } from '../src/app/game/game.service';
import type { GpuOperatingState } from '../src/app/game/gpu-operation';
import type { Scene } from 'three';

interface SceneDebug {
  game: GameService;
  scene: { scene: Scene };
}

async function seedGpu(page: Page, changes: Partial<GpuOperatingState>) {
  await page.evaluate((changes) => {
    const debug = window as unknown as { ng: { getComponent(element: Element): SceneDebug } };
    const { game } = debug.ng.getComponent(document.querySelector('app-scene')!);
    game.world.update((world) => ({
      ...world,
      plots: world.plots.map((plot) => ({
        ...plot,
        rigs: plot.rigs.map((rig) => ({
          ...rig,
          gpus: rig.gpus.map((gpu) =>
            gpu.id === 1 ? { ...gpu, ...changes, lastUpdatedAt: Date.now() } : gpu,
          ),
        })),
      })),
    }));
  }, changes);
}

async function state(page: Page) {
  return page.evaluate(() => {
    const debug = window as unknown as { ng: { getComponent(element: Element): SceneDebug } };
    const { game, scene } = debug.ng.getComponent(document.querySelector('app-scene')!);
    const gpu = scene.scene.getObjectByName('gpu-1')!;
    return {
      first: game.world().plots[0].rigs[0].gpus[0],
      second: game.world().plots[0].rigs[0].gpus[1],
      inspected: game.inspectedGpuId(),
      heatVisible: gpu.getObjectByName('gpu-heat-plume')?.visible,
      dustVisible: gpu.getObjectByName('gpu-dust-cloud')?.visible,
      fanKitVisible: gpu.getObjectByName('gpu-fan-kit')?.visible,
    };
  });
}

test('workbench services one GPU, enforces cooldown and retains upgrades in the rig', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  const firstSlot = page.getByRole('button', { name: 'GPU 001 sbloccata', exact: true });
  await expect(firstSlot).toBeVisible();
  await seedGpu(page, { dustPercent: 76, wearPercent: 28 });
  const before = await state(page);
  await firstSlot.dblclick();
  const panel = page.getByRole('complementary', { name: 'GPU 001' });
  await expect(panel).toBeVisible();
  await expect(page.locator('.editor-window')).toBeHidden();
  await expect(panel.getByTestId('bench-dust')).toHaveText('76.0%');
  const bounds = await panel.boundingBox();
  expect(bounds!.x).toBeGreaterThan(page.viewportSize()!.width / 2);
  await expect.poll(async () => (await state(page)).dustVisible).toBe(true);
  // Aspetta il trasferimento della GPU prima di acquisire la vista dell'officina.
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'test-results/workbench-dust.png' });
  await panel.getByRole('button', { name: 'Pulisci scheda', exact: true }).click();
  await expect(panel.getByTestId('bench-dust')).toHaveText('0.0%');
  await expect(panel.getByTestId('bench-wear')).toHaveText('28.00%');
  await panel.getByRole('button', { name: /02 Pasta e pad termici/ }).click();
  await panel.getByRole('button', { name: 'Sostituisci pasta e pad', exact: true }).click();
  await expect(panel.getByTestId('bench-wear')).toHaveText('0.00%');
  await expect(panel.getByRole('button', { name: 'In attesa di utilizzo' })).toBeDisabled();
  await expect(panel).toContainText('24.0 h');
  await panel.getByRole('button', { name: /03 Ventole/ }).click();
  await panel.getByRole('button', { name: /Alta portata/ }).click();
  await expect.poll(async () => (await state(page)).fanKitVisible).toBe(true);
  await expect(panel.getByRole('slider')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/workbench-fans.png' });
  await panel.getByRole('button', { name: /Rimonta nel rig/ }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator('.editor-window')).toBeVisible();
  expect((await state(page)).first.fanKit).toBe('performance');
  expect((await state(page)).second).toEqual(before.second);
  await firstSlot.dblclick();
  await panel.getByRole('button', { name: /02 Pasta e pad termici/ }).click();
  await expect(panel.getByRole('button', { name: 'In attesa di utilizzo' })).toBeDisabled();
  await panel.getByRole('button', { name: /Rimonta nel rig/ }).click();
  await page.evaluate(async () => {
    const debug = window as unknown as { ng: { getComponent(element: Element): SceneDebug } };
    const { game } = debug.ng.getComponent(document.querySelector('app-scene')!);
    game.setLineEffectsEnabled(false);
    game.speed.set(10);
    game.updateCode('plots[0].rigs[0].gpus[0].mine();');
    await game.run();
  });
  expect((await state(page)).first.hoursSinceThermalService).toBe(1);
  await firstSlot.dblclick();
  await panel.getByRole('button', { name: /02 Pasta e pad termici/ }).click();
  await expect(panel).toContainText('23.0 h');
  expect(errors).toEqual([]);
});

test('condition effects react to heat; compact workbench keeps all actions reachable', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'GPU 001 sbloccata', exact: true }).dblclick();
  await page.waitForTimeout(1300);
  await seedGpu(page, { dustPercent: 90, wearPercent: 45, temperatureCelsius: 100 });
  await expect.poll(async () => (await state(page)).heatVisible).toBe(true);
  await page.screenshot({ path: 'test-results/workbench-heat.png' });
  await expect.poll(async () => (await state(page)).heatVisible).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = page.getByRole('complementary', { name: 'GPU 001' });
  const bounds = await panel.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await panel.getByRole('button', { name: /03 Ventole/ }).click();
  await panel.getByRole('button', { name: /Silenziosa/ }).click();
  await page.screenshot({ path: 'test-results/workbench-mobile.png' });
  await panel.getByRole('button', { name: /Rimonta nel rig/ }).click();
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});

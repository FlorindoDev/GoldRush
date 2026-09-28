import { expect, test, type Page } from '@playwright/test';
import { GAMEPLAY_RIG_SETUP } from '../src/app/config/rig-config';
import { createGpuOperatingState } from '../src/app/game/gpu-operation';
import { createWorld } from '../src/app/game/mining-world';
import { defaultScriptFiles } from '../src/app/game/script-storage';

async function dropStockOnScene(page: Page, row: number, targetKind: 'rig' | 'gpu'): Promise<void> {
  const position = await page.evaluate(
    async ({ row, targetKind }) => {
      const source = document.querySelectorAll<HTMLElement>('.stock-item')[row];
      const canvas = document.querySelector<HTMLCanvasElement>('app-scene canvas');
      if (!source || !canvas) return null;
      const transfer = new DataTransfer();
      source.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }),
      );
      await new Promise(requestAnimationFrame);
      const bounds = canvas.getBoundingClientRect();
      for (let y = bounds.top + 100; y < bounds.bottom - 70; y += 38) {
        for (let x = Math.max(bounds.left + 420, 420); x < bounds.right - 60; x += 38) {
          canvas.dispatchEvent(
            new DragEvent('dragover', {
              bubbles: true,
              cancelable: true,
              dataTransfer: transfer,
              clientX: x,
              clientY: y,
            }),
          );
          await new Promise(requestAnimationFrame);
          if (canvas.dataset.placementTarget === targetKind) {
            source.dispatchEvent(
              new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }),
            );
            return { x: x - bounds.left, y: y - bounds.top };
          }
        }
      }
      return null;
    },
    { row, targetKind },
  );
  expect(position).not.toBeNull();
  const source = await page.locator('.stock-item').nth(row).boundingBox();
  const canvas = await page.locator('app-scene canvas').boundingBox();
  expect(source).not.toBeNull();
  expect(canvas).not.toBeNull();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(source!.x + source!.width / 2 + 24, source!.y + source!.height / 2, {
    steps: 5,
  });
  await page.mouse.move(canvas!.x + position!.x, canvas!.y + position!.y, { steps: 14 });
  await page.waitForTimeout(250);
  await expect(page.locator('.placement-grab-hand')).toBeVisible();
  await expect(page.locator('app-scene canvas')).toHaveAttribute(
    'data-placement-target',
    targetKind,
  );
  await page.mouse.up();
  await expect(page.locator('.placement-grab-hand')).toHaveCount(0);
}

async function findPlacedItemPoints(
  page: Page,
  kind: 'rig' | 'gpu',
  count: number,
): Promise<{ id: number; x: number; y: number }[]> {
  return page.evaluate(
    ({ kind, count }) => {
      const component = (window as any).ng.getComponent(document.querySelector('app-scene'));
      const bounds = document.querySelector('app-scene canvas')!.getBoundingClientRect();
      const found: { id: number; x: number; y: number }[] = [];
      for (let y = bounds.top + 80; y < bounds.bottom - 50; y += 18) {
        for (let x = Math.max(bounds.left + 420, 420); x < bounds.right - 60; x += 18) {
          const item = component.scene.placedItemAt(x, y);
          if (item?.kind !== kind || found.some((point) => point.id === item.id)) continue;
          found.push({ id: item.id, x, y });
          if (found.length === count) return found;
        }
      }
      return found;
    },
    { kind, count },
  );
}

async function findEmptyTargetPoint(
  page: Page,
  kind: 'rig' | 'gpu',
): Promise<{
  rigId: number;
  slotGpuId?: number;
  x: number;
  y: number;
} | null> {
  return page.evaluate((kind) => {
    const component = (window as any).ng.getComponent(document.querySelector('app-scene'));
    const bounds = document.querySelector('app-scene canvas')!.getBoundingClientRect();
    for (let y = bounds.top + 80; y < bounds.bottom - 50; y += 18) {
      for (let x = Math.max(bounds.left + 420, 420); x < bounds.right - 60; x += 18) {
        const target = component.scene.placementTargetAt(x, y, kind);
        if (target) return { ...target, x, y };
      }
    }
    return null;
  }, kind);
}

async function dragPlacedItem(
  page: Page,
  source: { x: number; y: number },
  target: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(source.x + 24, source.y, { steps: 5 });
  await page.mouse.move(target.x, target.y, { steps: 14 });
  await page.waitForTimeout(200);
  await page.mouse.up();
}

test('placement mode hides the old HUD and mounts stock on the 3D farm', async ({ page }) => {
  const world = createWorld();
  const save = {
    version: 1,
    savedAt: Date.now(),
    world: {
      ...world,
      inventory: {
        nextId: 3,
        items: [
          {
            id: 1,
            productId: 'rig-gameplay',
            rig: { setup: GAMEPLAY_RIG_SETUP, gpus: [null, null, null, null], isNew: true },
          },
          { id: 2, productId: 'gpu-passive', gpu: createGpuOperatingState('gpu-passive') },
        ],
      },
    },
    gameElapsedMinutes: 0,
    files: defaultScriptFiles(),
    activeFileId: 'main',
    speed: 1,
  };
  await page.addInitScript(
    (data) => localStorage.setItem('goldrush-game-save-v1', JSON.stringify(data)),
    save,
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Vai a Computer' }).click();
  await page.getByRole('button', { name: 'Apri Posizionamento' }).click();
  await expect(page.locator('.game-shell')).toHaveClass(/placement-mode/);
  await expect(page.locator('.status-panels')).toBeHidden();
  await expect(page.locator('app-scene-controls')).toHaveCount(0);
  await expect(page.locator('.category-toggle')).toHaveCount(2);
  await expect(page.locator('.toolbar-top, .plot-navigation')).toHaveCount(0);
  await expect(page.locator('.plot-keypad button')).toHaveCount(6);
  await expect(page.locator('.stock-item')).toHaveCount(0);
  await page.getByRole('button', { name: 'Vai al Plot 2' }).click();
  await expect(page.getByRole('button', { name: 'Vai al Plot 2' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Vai al Plot 1' }).click();
  await page.getByRole('button', { name: /Apri RIG/ }).click();
  await expect(page.locator('.stock-item')).toHaveCount(1);
  const categoryBox = await page.locator('.category-toggle').first().boundingBox();
  const stockBox = await page.locator('.stock-item').first().boundingBox();
  expect(stockBox?.width).toBe(categoryBox?.width);
  expect(stockBox?.height).toBe(categoryBox?.height);
  await expect(page.locator('.stock-list')).toHaveCSS('animation-name', /stock-slide-in$/);
  await expect(page.locator('.category-preview img')).toHaveCount(2);
  await page.waitForTimeout(1300);

  await dropStockOnScene(page, 0, 'rig');
  await expect(page.locator('.placement-notice')).toHaveCount(0);
  await expect(page.locator('.stock-item')).toHaveCount(0);

  await page.getByRole('button', { name: /Apri GPU/ }).click();
  await expect(page.locator('.stock-item')).toHaveCount(1);
  await dropStockOnScene(page, 0, 'gpu');
  await expect(page.locator('.stock-item')).toHaveCount(0);

  const [gpu] = await findPlacedItemPoints(page, 'gpu', 1);
  expect(gpu).toBeDefined();
  await page.mouse.click(gpu.x, gpu.y, { button: 'right' });
  await page.getByRole('button', { name: 'Rimetti in magazzino' }).click();
  await expect(page.getByRole('button', { name: 'Apri GPU, 1 in magazzino' })).toBeVisible();
  await expect(page.locator('.stock-item')).toHaveCount(1);
  await dropStockOnScene(page, 0, 'gpu');
  await expect(page.locator('.stock-item')).toHaveCount(0);

  const [mountedGpu] = await findPlacedItemPoints(page, 'gpu', 1);
  const emptyGpu = await findEmptyTargetPoint(page, 'gpu');
  expect(mountedGpu).toBeDefined();
  expect(emptyGpu?.slotGpuId).toBeDefined();
  await dragPlacedItem(page, mountedGpu, emptyGpu!);
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const component = (window as any).ng.getComponent(document.querySelector('app-scene'));
        return component.game
          .world()
          .plots.flatMap((plot: any) => plot.rigs)
          .flatMap((rig: any) => rig.gpus)
          .find((gpu: any) => gpu.id === id)?.unlocked;
      }, emptyGpu!.slotGpuId),
    )
    .toBe(true);

  const rigs = await findPlacedItemPoints(page, 'rig', 2);
  expect(rigs).toHaveLength(2);
  await page.keyboard.down('Control');
  for (const rig of rigs) await page.mouse.click(rig.x, rig.y);
  await page.keyboard.up('Control');
  await page.mouse.click(rigs[1].x, rigs[1].y, { button: 'right' });
  await page.getByRole('button', { name: 'Rimetti 2 elementi in magazzino' }).click();
  await expect(page.getByRole('button', { name: 'Apri RIG, 2 in magazzino' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apri GPU, 2 in magazzino' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.game-shell')).not.toHaveClass(/placement-mode/);
  await expect(page.locator('.status-panels')).toBeVisible();
});

test('dragging a mounted RIG moves its GPUs without changing stock', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Vai a Computer' }).click();
  await page.getByRole('button', { name: 'Apri Posizionamento' }).click();
  await page.waitForTimeout(1200);

  const source = (await findPlacedItemPoints(page, 'rig', 1))[0];
  const target = await findEmptyTargetPoint(page, 'rig');
  expect(source).toBeDefined();
  expect(target).not.toBeNull();
  const initialStock = await page.evaluate(
    () =>
      (window as any).ng.getComponent(document.querySelector('app-scene')).game.world().inventory
        .items.length,
  );
  await dragPlacedItem(page, source, target!);

  await expect
    .poll(() =>
      page.evaluate((rigId) => {
        const component = (window as any).ng.getComponent(document.querySelector('app-scene'));
        const rig = component.game
          .world()
          .plots.flatMap((plot: any) => plot.rigs)
          .find((entry: any) => entry.id === rigId);
        return {
          mounted: rig?.unlocked,
          gpuMounted: rig?.gpus[0]?.unlocked,
          stock: component.game.world().inventory.items.length,
        };
      }, target!.rigId),
    )
    .toEqual({ mounted: true, gpuMounted: true, stock: initialStock });
});

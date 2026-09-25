import { expect, test, type Page } from '@playwright/test';
import type { PerspectiveCamera, Scene } from 'three';
import type { GameService } from '../src/app/game/game.service';

interface DebugComponent {
  game: GameService;
  scene: {
    scene: Scene;
    camera: PerspectiveCamera;
    findGpuAtPointer(event: { clientX: number; clientY: number }): number | undefined;
  };
}

async function state(page: Page) {
  return page.evaluate(() => {
    const debug = window as unknown as { ng: { getComponent(element: Element): DebugComponent } };
    const { game, scene } = debug.ng.getComponent(document.querySelector('app-scene')!);
    return {
      selected: game.selectedGpuId(),
      inspected: game.inspectedGpuId(),
      position: scene.scene.getObjectByName('gpu-1')!.position.toArray(),
      camera: scene.camera.position.toArray(),
    };
  });
}

async function findGpuPoint(page: Page) {
  return page.evaluate(() => {
    const debug = window as unknown as { ng: { getComponent(element: Element): DebugComponent } };
    const view = debug.ng.getComponent(document.querySelector('app-scene')!).scene;
    const gpu = view.scene.getObjectByName('gpu-1')!;
    view.scene.updateMatrixWorld(true);
    view.camera.updateMatrixWorld(true);
    const position = gpu.position.clone().project(view.camera);
    const canvas = document.querySelector('app-scene canvas')!.getBoundingClientRect();
    const x = canvas.left + ((position.x + 1) * canvas.width) / 2;
    const y = canvas.top + ((1 - position.y) * canvas.height) / 2;
    for (let dy = -75; dy <= 75; dy += 5) {
      for (let dx = -75; dx <= 75; dx += 5) {
        const point = { x: x + dx, y: y + dy };
        if (
          view.findGpuAtPointer({ clientX: point.x, clientY: point.y }) === 1 &&
          document.elementFromPoint(point.x, point.y)?.tagName === 'CANVAS'
        ) {
          return point;
        }
      }
    }
    return null;
  });
}

async function gpuPoint(page: Page): Promise<{ x: number; y: number }> {
  let point: { x: number; y: number } | null = null;
  await expect
    .poll(async () => {
      point = await findGpuPoint(page);
      return point !== null;
    })
    .toBe(true);
  return point!;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'GPU 001 sbloccata', exact: true })).toBeVisible();
});

test('single HUD click selects without moving the card or camera; double click transfers it', async ({
  page,
}) => {
  const first = page.getByRole('button', { name: 'GPU 001 sbloccata', exact: true });
  const before = await state(page);
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  expect(await state(page)).toEqual({ ...before, selected: 1 });
  await page.locator('app-power .power-panel > summary').click();
  await expect(page.locator('app-power .gpu-heading')).toHaveText(/GPU 1\s*PRONTA/);
  await page.locator('app-power .power-panel > summary').click();
  await first.dblclick();
  await expect.poll(async () => (await state(page)).inspected).toBe(1);
  await expect
    .poll(async () => (await state(page)).position[0])
    .toBeGreaterThan(before.position[0] + 1);
  await page.getByRole('button', { name: 'Torna al quadrato di sblocco', exact: true }).click();
  await expect.poll(async () => (await state(page)).position[0]).toBeCloseTo(before.position[0], 2);
  expect((await state(page)).selected).toBe(1);
});

test('HUD hover and focus never show a tooltip; keyboard selection and inspection still work', async ({
  page,
}) => {
  const before = await state(page);
  const first = page.getByRole('button', { name: 'GPU 001 sbloccata', exact: true });
  await first.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toHaveCount(0);
  await first.focus();
  await expect(tooltip).toHaveCount(0);
  expect(await state(page)).toEqual(before);
  const point = await gpuPoint(page);
  await page.mouse.move(point.x, point.y);
  await expect(tooltip).toContainText('GPU 1');
  await expect(tooltip).toContainText('Temperatura');
  await expect(tooltip).toContainText('34.0 °C');
  await expect(tooltip).toContainText('Usura');
  await expect(tooltip).toContainText('0.00%');
  await expect(tooltip).toContainText('32 W');
  expect(await state(page)).toEqual(before);
  await first.hover();
  await expect(tooltip).toHaveCount(0);
  await first.focus();
  await expect(tooltip).toHaveCount(0);
  await page.keyboard.press('Enter');
  expect((await state(page)).selected).toBe(1);
  expect((await state(page)).inspected).toBeNull();
  await page.keyboard.press('Alt+Enter');
  await expect.poll(async () => (await state(page)).inspected).toBe(1);
});

test('scene GPU supports hover, single selection and double click inspection', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const before = await state(page);
  const point = await gpuPoint(page);
  await page.mouse.move(point.x, point.y);
  await expect(page.getByRole('tooltip')).toContainText('GPU 1');
  await page.screenshot({ path: 'test-results/gpu-hover-scene.png', animations: 'disabled' });
  await page.mouse.click(point.x, point.y);
  await expect.poll(async () => (await state(page)).selected).toBe(1);
  expect((await state(page)).inspected).toBeNull();
  expect((await state(page)).position).toEqual(before.position);
  await page.mouse.dblclick(point.x, point.y);
  await expect.poll(async () => (await state(page)).inspected).toBe(1);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('dragging the scene hides the preview and never selects or inspects a GPU', async ({
  page,
}) => {
  const point = await gpuPoint(page);
  await page.mouse.move(point.x, point.y);
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.mouse.down();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.mouse.move(point.x + 70, point.y + 10, { steps: 8 });
  await page.mouse.up();
  expect((await state(page)).selected).toBeNull();
  expect((await state(page)).inspected).toBeNull();
});

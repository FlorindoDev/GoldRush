import { expect, Page, test } from '@playwright/test';
import type { Group, PerspectiveCamera, Scene } from 'three';

interface SceneDebugView {
  scene: Scene;
  camera: PerspectiveCamera;
  workbench: { ore: Group };
  findBlockAtPointer(event: { clientX: number; clientY: number }): number | undefined;
  game: {
    reset(): void;
    world: {
      set(value: {
        blocks: Array<{ id: number; progress: number }>;
        selectedId: number;
        satoshis: number;
      }): void;
    };
  };
}

declare global {
  interface Window {
    ng: {
      getComponent(element: Element | null): {
        scene: SceneDebugView;
        game: SceneDebugView['game'];
      };
    };
  }
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const miningScene = window.ng.getComponent(document.querySelector('app-scene')).scene;
    const { scene, camera } = miningScene;
    const cards = scene.children.filter(
      (object) => object.name.startsWith('gpu-') && object.name !== 'gpu-mining-rig',
    );
    const workbench = scene.getObjectByName('workbench')!;
    const benchX = workbench.position.x;
    return {
      cards: cards.map((card) => ({
        id: card.userData['blockId'] as number,
        position: card.position.toArray(),
      })),
      onBench: cards
        .filter(
          (card) =>
            Math.abs(card.position.x - benchX) < 1 &&
            Math.abs(card.position.z - workbench.position.z) < 1,
        )
        .map((card) => card.userData['blockId'] as number),
      camera: camera.position.toArray(),
      bitcoinScale: miningScene.workbench.ore.scale.toArray(),
      benchCount: scene.children.filter((object) => object.name === 'workbench').length,
      benchPosition: workbench.position.toArray(),
      toolAreaCount: scene.children.filter((object) => object.name === 'tool-area').length,
      toolAreaPosition: scene.getObjectByName('tool-area')!.position.toArray(),
      plots: scene.children
        .filter((object) => object.name === 'rig-plot')
        .map((plot) => plot.userData['plotId'] as number),
      rigs: scene.children
        .filter((object) => object.name === 'gpu-mining-rig')
        .map((rig) => ({ id: rig.userData['rigId'] as number, position: rig.position.toArray() })),
    };
  });
}

async function waitForGpuOnBench(page: Page, id: number) {
  await expect.poll(async () => (await snapshot(page)).onBench).toEqual([id]);
  await expect
    .poll(async () => (await snapshot(page)).cards.find((card) => card.id === id)!.position[1])
    .toBeCloseTo(1.91, 2);
}

async function unlockSecondGpu(page: Page) {
  await page
    .getByRole('textbox', { name: 'Codice MineScript' })
    .fill('let gpu = plots[0].rig(0).gpu(0); repeat (5) { gpu.mine(); }');
  await page.getByRole('button', { name: 'Avvia codice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Seleziona GPU 002', exact: true })).toBeEnabled({
    timeout: 15000,
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Controlli scena' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'GPU del mining rig' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('empty workbench, physical GPU click, animated transfer and return', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const initial = await snapshot(page);
  expect(initial.benchCount).toBe(1);
  expect(initial.cards).toHaveLength(1);
  expect(initial.onBench).toEqual([]);
  expect(initial.benchPosition[0]).toBeGreaterThan(initial.rigs[0].position[0] + 5);
  expect(Math.abs(initial.benchPosition[2] - initial.rigs[0].position[2])).toBeGreaterThan(10);
  const hud = await page.locator('.scene-hud').boundingBox();
  expect(hud!.height).toBeGreaterThan(hud!.width);
  await expect(page.getByRole('button', { name: 'Slot GPU 002 bloccato' })).toBeDisabled();

  const point = await page.evaluate(() => {
    const { scene, camera } = window.ng.getComponent(document.querySelector('app-scene')).scene;
    const gpu = scene.getObjectByName('gpu-1') as Group;
    // Pick the visible fan face below the frame's front crossbar.
    const position = gpu.position.clone();
    position.x += 0.2;
    position.y -= 0.35;
    position.project(camera);
    const canvas = document.querySelector('app-scene canvas')!.getBoundingClientRect();
    const x = canvas.left + ((position.x + 1) * canvas.width) / 2;
    const y = canvas.top + ((1 - position.y) * canvas.height) / 2;
    const miningScene = window.ng.getComponent(document.querySelector('app-scene')).scene;
    for (let offsetY = -70; offsetY <= 70; offsetY += 5) {
      for (let offsetX = -70; offsetX <= 70; offsetX += 5) {
        const candidate = { x: x + offsetX, y: y + offsetY };
        const blockId = miningScene.findBlockAtPointer({
          clientX: candidate.x,
          clientY: candidate.y,
        });
        if (
          blockId === 1 &&
          document.elementFromPoint(candidate.x, candidate.y)?.tagName === 'CANVAS'
        ) {
          return { ...candidate, blockId };
        }
      }
    }
    return { x, y, blockId: undefined };
  });
  expect(point.blockId).toBe(1);
  await page.mouse.click(point.x, point.y);
  await expect(
    page.getByRole('button', { name: 'Seleziona GPU 001', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => (await snapshot(page)).cards[0].position[0])
    .toBeGreaterThan(initial.cards[0].position[0] + 0.1);
  await waitForGpuOnBench(page, 1);
  expect((await snapshot(page)).camera).not.toEqual(initial.camera);
  await page.getByRole('button', { name: 'Torna al mining rig' }).click();
  await expect
    .poll(async () => (await snapshot(page)).cards[0].position[0])
    .toBeCloseTo(initial.cards[0].position[0], 2);
  expect((await snapshot(page)).onBench).toEqual([]);
  await expect(
    page.getByRole('button', { name: 'Seleziona GPU 001', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('repeated scene clicks do not interrupt the workbench camera transition', async ({ page }) => {
  await page.getByRole('button', { name: 'Seleziona GPU 001', exact: true }).click();
  await page.waitForTimeout(150);
  const inTransition = await snapshot(page);
  expect(Math.abs(inTransition.camera[0] - (inTransition.benchPosition[0] + 5.3))).toBeGreaterThan(
    0.1,
  );

  const canvas = page.locator('app-scene canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  for (let click = 0; click < 4; click++) {
    await canvas.click({ position: { x: bounds!.width * 0.65, y: bounds!.height * 0.85 } });
    await page.waitForTimeout(100);
  }

  await expect
    .poll(async () => {
      const { camera, benchPosition } = await snapshot(page);
      return (
        Math.abs(camera[0] - (benchPosition[0] + 5.3)) < 0.1 &&
        Math.abs(camera[1] - 6.65) < 0.1 &&
        Math.abs(camera[2] - (benchPosition[2] + 10)) < 0.1
      );
    })
    .toBe(true);
});

test('camera can pan within the viewed rig area', async ({ page }) => {
  const canvas = page.locator('app-scene canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const initial = await snapshot(page);

  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(bounds!.x + bounds!.width / 2 + 110, bounds!.y + bounds!.height / 2 + 60, {
    steps: 6,
  });
  await page.mouse.up({ button: 'right' });

  await expect.poll(async () => (await snapshot(page)).camera).not.toEqual(initial.camera);
});

test('plots contain six rigs and can be selected independently', async ({ page }) => {
  await page.evaluate(() => {
    window.ng.getComponent(document.querySelector('app-scene')).game.world.set({
      blocks: Array.from({ length: 25 }, (_, index) => ({ id: index + 1, progress: 0 })),
      selectedId: 25,
      satoshis: 0,
    });
  });

  await page.getByRole('button', { name: 'Vai a Plot 2' }).click();
  await expect(page.getByRole('button', { name: 'Visualizza Rig 7' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(async () => (await snapshot(page)).rigs.length).toBe(7);
  const scene = await snapshot(page);
  expect(scene.plots).toEqual([1, 2]);
  expect(
    scene.rigs.find((rig) => rig.id === 7)!.position[0] -
      scene.rigs.find((rig) => rig.id === 1)!.position[0],
  ).toBeCloseTo(16.6, 5);
  await expect(page.getByRole('button', { name: 'Seleziona GPU 025', exact: true })).toBeEnabled();
});

test('HUD jumps directly between plots and returns an inspected GPU to its rig', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.ng.getComponent(document.querySelector('app-scene')).game.world.set({
      blocks: Array.from({ length: 49 }, (_, index) => ({ id: index + 1, progress: 0 })),
      selectedId: 1,
      satoshis: 0,
    });
  });
  const firstPlot = page.getByRole('button', { name: 'Vai a Plot 1', exact: true });
  const thirdPlot = page.getByRole('button', { name: 'Vai a Plot 3', exact: true });
  const workbench = page.getByRole('button', { name: 'Vai a Workbench' });

  await thirdPlot.click();
  await expect(thirdPlot).toHaveAttribute('aria-pressed', 'true');
  await expect(firstPlot).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByRole('button', { name: 'Visualizza Rig 13', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Seleziona GPU 049', exact: true }).click();
  await waitForGpuOnBench(page, 49);
  await expect(workbench).toHaveAttribute('aria-pressed', 'true');
  await expect(thirdPlot).toHaveAttribute('aria-pressed', 'false');

  await workbench.click();
  expect((await snapshot(page)).onBench).toEqual([49]);
  await firstPlot.click();
  await expect(firstPlot).toHaveAttribute('aria-pressed', 'true');
  await expect(workbench).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await snapshot(page)).onBench).toEqual([]);
  await expect(page.getByRole('button', { name: 'Seleziona GPU 001', exact: true })).toBeEnabled();
});

test('workbench is in the dedicated tool area and can be focused from the HUD', async ({
  page,
}) => {
  const initial = await snapshot(page);
  expect(initial.toolAreaCount).toBe(1);
  expect(initial.benchPosition[0]).toBeGreaterThan(initial.rigs[0].position[0] + 35);
  expect(initial.benchPosition[0]).toBeLessThan(initial.toolAreaPosition[0]);

  const locationButton = page.getByRole('button', { name: 'Vai a Workbench' });
  await locationButton.click();
  await expect(page.getByRole('button', { name: 'Vai a Plot 1' })).toBeVisible();
  await expect
    .poll(async () => (await snapshot(page)).camera[0])
    .toBeGreaterThan(initial.camera[0] + 25);

  await expect
    .poll(async () => {
      const { camera, benchPosition } = await snapshot(page);
      return (
        Math.abs(camera[0] - (benchPosition[0] + 5.3)) < 0.1 &&
        Math.abs(camera[1] - 6.65) < 0.1 &&
        Math.abs(camera[2] - (benchPosition[2] + 10)) < 0.1
      );
    })
    .toBe(true);
  const workbenchFrontY = (await snapshot(page)).camera[1];

  const frontView = page.getByRole('button', { name: 'Vista frontale' });
  const topView = page.getByRole('button', { name: "Vista dall'alto" });
  await topView.click();
  await expect
    .poll(async () => (await snapshot(page)).camera[1])
    .toBeGreaterThan(workbenchFrontY + 5);
  await frontView.click();
  await expect
    .poll(async () => Math.abs((await snapshot(page)).camera[1] - workbenchFrontY))
    .toBeLessThan(0.1);

  await page.getByRole('button', { name: 'Vai a Plot 1' }).click();
  await expect
    .poll(async () => Math.abs((await snapshot(page)).camera[0] - initial.camera[0]))
    .toBeLessThan(0.1);
});

test('plot HUD switches between front and overhead views', async ({ page }) => {
  await page.evaluate(() => {
    window.ng.getComponent(document.querySelector('app-scene')).game.world.set({
      blocks: Array.from({ length: 25 }, (_, index) => ({ id: index + 1, progress: 0 })),
      selectedId: 25,
      satoshis: 0,
    });
  });
  const initialCamera = (await snapshot(page)).camera;
  const plotControls = page.getByRole('navigation', { name: 'Controlli scena' });
  const topView = plotControls.getByRole('button', { name: "Vista dall'alto" });
  const frontView = plotControls.getByRole('button', { name: 'Vista frontale' });

  await topView.click();
  await expect(topView).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => (await snapshot(page)).camera[1])
    .toBeGreaterThan(initialCamera[1] + 10);

  await plotControls.getByRole('button', { name: 'Vai a Plot 2' }).click();
  await expect(page.getByRole('button', { name: 'Visualizza Rig 7' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(async () => (await snapshot(page)).camera[0]).toBeGreaterThan(15);
  await expect(topView).toHaveAttribute('aria-pressed', 'true');

  await frontView.click();
  await expect(frontView).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => {
      const camera = (await snapshot(page)).camera;
      return Math.abs(camera[1] - initialCamera[1]) < 0.1 && camera[0] > initialCamera[0] + 15;
    })
    .toBe(true);
});

test('unlocked GPUs share one rig; rapid switching and reset leave one empty bench', async ({
  page,
}) => {
  await unlockSecondGpu(page);
  expect((await snapshot(page)).cards).toHaveLength(2);
  expect((await snapshot(page)).onBench).toEqual([]);
  await page.getByRole('button', { name: 'Seleziona GPU 001', exact: true }).click();
  await page.getByRole('button', { name: 'Seleziona GPU 002', exact: true }).click();
  await waitForGpuOnBench(page, 2);
  expect((await snapshot(page)).benchCount).toBe(1);
  await page.getByRole('button', { name: 'Torna al mining rig' }).click();
  await page.getByRole('button', { name: 'Seleziona GPU 001', exact: true }).click();
  await waitForGpuOnBench(page, 1);
  await page.evaluate(() =>
    window.ng.getComponent(document.querySelector('app-scene')).game.reset(),
  );
  await expect.poll(async () => (await snapshot(page)).cards.length).toBe(1);
  await expect.poll(async () => (await snapshot(page)).onBench).toEqual([]);
  await expect(page.getByRole('button', { name: 'Torna al mining rig' })).toHaveCount(0);
});

test('mining locks selection; automatic unlock keeps the inspected GPU on the bench', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Seleziona GPU 001', exact: true }).click();
  await waitForGpuOnBench(page, 1);
  await page
    .getByRole('textbox', { name: 'Codice MineScript' })
    .fill('let gpu = plots[0].rig(0).gpu(0); repeat (5) { gpu.mine(); }');
  await page.getByRole('button', { name: 'Avvia codice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Seleziona GPU 001', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Seleziona GPU 002', exact: true })).toBeEnabled({
    timeout: 15000,
  });
  expect((await snapshot(page)).onBench).toEqual([1]);
  expect((await snapshot(page)).bitcoinScale).toEqual([1, 1, 1]);
  expect((await snapshot(page)).cards).toHaveLength(2);
});

test('fallback model remains selectable when GPU assets fail', async ({ page }) => {
  await page.route('**/models/modello-gpu/**', (route) => route.abort());
  await page.reload();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Seleziona GPU 001', exact: true }).click();
  await waitForGpuOnBench(page, 1);
  await page.getByRole('button', { name: 'Torna al mining rig' }).click();
  await expect.poll(async () => (await snapshot(page)).onBench).toEqual([]);
});

test('mobile keyboard controls remain reachable and respect reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const gpuButton = page.getByRole('button', { name: 'Seleziona GPU 001', exact: true });
  await gpuButton.click({ trial: true });
  await gpuButton.focus();
  await page.keyboard.press('Enter');
  await waitForGpuOnBench(page, 1);
  await page.getByRole('button', { name: 'Torna al mining rig' }).click();
  await expect.poll(async () => (await snapshot(page)).onBench).toEqual([]);
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(horizontalOverflow).toBe(false);
});

test('new rigs keep unlocking; each GPU returns to its own rig and reset removes expansions', async ({
  page,
}) => {
  test.setTimeout(65000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('button', { name: 'Seleziona GPU 001', exact: true }).click();
  await waitForGpuOnBench(page, 1);
  await page
    .getByRole('textbox', { name: 'Codice MineScript' })
    .fill('let gpu = plots[0].rig(0).gpu(0); repeat (40) { gpu.mine(); }');
  await page.getByRole('button', { name: 'Avvia codice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Interrompi esecuzione' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Avvia codice', exact: true })).toBeVisible({
    timeout: 45000,
  });
  const expanded = await snapshot(page);
  expect(expanded.rigs).toHaveLength(3);
  expect(expanded.cards).toHaveLength(9);
  expect(expanded.onBench).toEqual([1]);
  await expect(page.getByRole('button', { name: 'Visualizza Rig 1' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Visualizza Rig 2' }).click();
  const home = expanded.cards.find((card) => card.id === 5)!.position;
  await page.getByRole('button', { name: 'Seleziona GPU 005', exact: true }).click();
  await waitForGpuOnBench(page, 5);
  await page.getByRole('button', { name: 'Torna al mining rig' }).click();
  await expect
    .poll(async () => (await snapshot(page)).cards.find((card) => card.id === 5)!.position[0])
    .toBeCloseTo(home[0], 2);
  await page.getByRole('button', { name: 'Visualizza Rig 3' }).click();
  await expect(page.getByRole('button', { name: 'Seleziona GPU 009', exact: true })).toBeEnabled();
  await page.evaluate(() =>
    window.ng.getComponent(document.querySelector('app-scene')).game.reset(),
  );
  await expect.poll(async () => (await snapshot(page)).rigs.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Visualizza Rig 1' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect((await snapshot(page)).cards).toHaveLength(1);
  expect(errors).toEqual([]);
});

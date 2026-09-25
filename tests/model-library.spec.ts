import { expect, test } from '@playwright/test';
import type { ModelCatalog } from '../src/app/assets/models/model-catalog';
import { GAME_BALANCE } from '../src/app/config/game-balance';

test('every catalog GLB is served with its license and rig sockets', async ({ request }) => {
  const response = await request.get('/assets/models/catalog.json');
  expect(response.ok()).toBe(true);
  const catalog: ModelCatalog = await response.json();
  expect(new Set(catalog.models.map((model) => model.id)).size).toBe(catalog.models.length);
  expect(catalog.models.filter((model) => model.category === 'rigs')).toHaveLength(28);
  expect(catalog.models.every((model) => model.path.endsWith('.glb'))).toBe(true);
  expect(
    catalog.models.some((model) => model.id.includes('quiet') || model.path.includes('legacy')),
  ).toBe(false);
  const coins = catalog.models.filter((model) => model.category === 'coins');
  expect(coins).toHaveLength(8);
  for (const coin of coins) {
    expect(coin.dimensions).toEqual(coins[0].dimensions);
  }
  const fans = catalog.models.filter((model) => model.category === 'fans');
  expect(fans).toHaveLength(7);
  for (let index = 1; index < fans.length; index++) {
    expect(fans[index].airflowCfm!).toBeGreaterThan(fans[index - 1].airflowCfm!);
    expect(fans[index].powerWatts!).toBeGreaterThan(fans[index - 1].powerWatts!);
  }
  for (const model of catalog.models) {
    const asset = await request.get('/' + model.path);
    expect(asset.ok(), model.id).toBe(true);
    const buffer = await asset.body();
    expect(buffer.toString('ascii', 0, 4), model.id).toBe('glTF');
    expect(buffer.readUInt32LE(4)).toBe(2);
    expect(buffer.readUInt32LE(8)).toBe(buffer.length);
    expect(buffer.length).toBe(model.bytes);
    const jsonLength = buffer.readUInt32LE(12);
    const gltf = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength));
    expect(gltf.meshes.length, model.id).toBeGreaterThan(0);
    if (model.slots) {
      const sockets = gltf.nodes.filter((node: { name?: string }) =>
        node.name?.startsWith('gpu-slot-'),
      );
      expect(sockets, model.id).toHaveLength(model.slots!);
      expect(sockets.filter((node: { children?: unknown[] }) => node.children?.length).length).toBe(
        model.populated ? model.slots! : 0,
      );
    }
    if (model.licensePath) {
      expect((await request.get('/' + model.licensePath)).ok()).toBe(true);
    }
  }
});

test('all models load in the viewer; search, tier details and mobile layout work', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const catalog: ModelCatalog = await (await request.get('/assets/models/catalog.json')).json();
  await page.goto('/?models=1');
  await expect(page.getByRole('heading', { name: 'La forma della potenza.' })).toBeVisible();
  const viewer = page.locator('.viewer');
  for (const model of catalog.models) {
    await page
      .locator('.model-item')
      .filter({ has: page.getByText(model.name, { exact: true }) })
      .click();
    await expect(viewer).toHaveAttribute('data-model-id', model.id);
    await expect(viewer).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: model.name, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Ventole', exact: true }).click();
  await expect(page.locator('.model-item')).toHaveCount(7);
  await page.getByRole('button', { name: 'Cyclone 200', exact: false }).click();
  await expect(viewer).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.specs')).toContainText('4200');
  await expect(page.locator('.specs')).toContainText('210');
  await page.getByRole('button', { name: 'Ferma ventole' }).click();
  await expect(page.getByRole('button', { name: 'Avvia ventole' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Tutti', exact: true }).click();
  await page.getByRole('searchbox').fill('inesistente');
  await expect(page.getByText('Nessun modello trovato.')).toBeVisible();
  await page.getByRole('searchbox').fill('rig-8-mesh-liquid');
  await expect(page.locator('.model-item')).toHaveCount(1);
  await page.locator('.model-item').click();
  await expect(viewer).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('searchbox').fill('');
  await page.screenshot({ path: 'test-results/model-library-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const download = page.getByRole('link', { name: 'Scarica GLB' });
  await download.scrollIntoViewIfNeeded();
  await expect(download).toBeInViewport();
  expect(
    await page
      .locator('app-model-library')
      .evaluate((element) => getComputedStyle(element).overflowY),
  ).toBe('auto');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/model-library-mobile.png' });
  expect(errors).toEqual([]);
});

test('failed model loads recover and rapid selections keep the latest model', async ({ page }) => {
  await page.route('**/gpus/gpu-compact.glb', (route) => route.abort());
  await page.goto('/?models=1&model=gpu-compact');
  await expect(page.getByRole('status')).toContainText('Modello non disponibile');
  await page.getByRole('button', { name: 'Miner D2', exact: false }).click();
  await expect(page.locator('.viewer')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.route('**/fans/fan-airflow-120.glb', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.getByRole('button', { name: 'Flow 120', exact: false }).click();
  await page.getByRole('button', { name: 'Cyclone 200', exact: false }).click();
  await expect(page.locator('.viewer')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.viewer')).toHaveAttribute('data-model-id', 'fan-turbine-200');
  await expect(page.getByRole('heading', { name: 'Cyclone 200' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('game loads relocated GPU and bitcoin assets', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const gpu = page.waitForResponse(
    `**/assets/models/gpus/${GAME_BALANCE.models.startingGpuId}.glb`,
  );
  const bitcoin = page.waitForResponse('**/assets/models/coins/bitcoin.glb');
  const rig = page.waitForResponse(
    `**/assets/models/rigs/${GAME_BALANCE.models.startingRigId}.glb`,
  );
  const bench = page.waitForResponse('**/assets/models/workshop/workbench.glb');
  await page.goto('/');
  expect((await gpu).ok()).toBe(true);
  expect((await bitcoin).ok()).toBe(true);
  expect((await rig).ok()).toBe(true);
  expect((await bench).ok()).toBe(true);
  await expect(page.locator('app-scene canvas')).toBeVisible();
  await expect(page.locator('app-hud')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'GPU 001 sbloccata', exact: true }).dblclick();
  await expect(page.locator('app-workbench')).toBeVisible();
  await page.getByRole('button', { name: 'Ventole', exact: true }).click();
  await expect(page.getByRole('button', { name: /Silenziosa/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Industriale/ }).click();
  await page.screenshot({ path: 'test-results/glb-workbench.png' });
  await page.getByRole('button', { name: 'Chiudi banco e rimonta GPU', exact: true }).click();
  await expect(page.locator('app-workbench')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/glb-game-rig.png' });
  expect(errors).toEqual([]);
});

test('the compact GLB remains usable when the main GPU asset fails', async ({ page }) => {
  await page.route(`**/gpus/${GAME_BALANCE.models.startingGpuId}.glb`, (route) => route.abort());
  const fallback = page.waitForResponse(`**/gpus/${GAME_BALANCE.models.fallbackGpuId}.glb`);
  await page.goto('/');
  expect((await fallback).ok()).toBe(true);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'GPU 001 sbloccata', exact: true }).dblclick();
  await expect(page.locator('app-workbench')).toBeVisible();
});

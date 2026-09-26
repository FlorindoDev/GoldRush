import { expect, test } from '@playwright/test';

test('apre l’albero a schermo intero e mostra modello, requisiti e costo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Albero della ricerca' }).click();
  const dialog = page.getByRole('dialog', { name: 'Albero della ricerca' });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds?.width).toBe(page.viewportSize()?.width);
  expect(bounds?.height).toBe(page.viewportSize()?.height);

  await dialog.getByRole('navigation').getByRole('button', { name: 'Filtri' }).click();
  await dialog.getByRole('button', { name: 'Filtro magnetico a rete, bloccato' }).click();
  await expect(dialog.getByRole('heading', { name: 'Filtro magnetico a rete' })).toBeVisible();
  await expect(dialog.getByText('Sblocca Filtri')).toBeVisible();
  await expect(
    dialog
      .getByRole('complementary', { name: 'Dettagli della ricerca' })
      .getByText('80,00 €', { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Sblocca ricerca' })).toBeDisabled();
  await expect(
    dialog.getByAltText('Modello 3D statico di Filtro magnetico a rete').first(),
  ).toBeVisible();

  await dialog.getByRole('button', { name: 'Chiudi albero della ricerca' }).click();
  await expect(dialog).not.toBeVisible();
});

test('zoom al cursore, trascinamento senza selezione e navigazione tra requisiti', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Albero della ricerca' }).click();
  const dialog = page.getByRole('dialog');
  const viewport = dialog.locator('.tree-scroll');
  const canvas = dialog.locator('.tree-canvas');
  const matrix = () =>
    canvas.evaluate((element) => {
      const matrix = new DOMMatrix(getComputedStyle(element).transform);
      return { scale: matrix.a, x: matrix.e, y: matrix.f };
    });
  await expect(dialog.locator('.research-node')).toHaveCount(12);
  const bounds = (await viewport.boundingBox())!;
  const before = await matrix();
  const anchor = {
    x: Math.round(bounds.x + 160) - bounds.x,
    y: Math.round(bounds.y + 130) - bounds.y,
  };
  await page.mouse.move(bounds.x + anchor.x, bounds.y + anchor.y);
  await page.mouse.wheel(0, -180);
  await expect.poll(async () => (await matrix()).scale).toBeGreaterThan(before.scale);
  const zoomed = await matrix();
  expect((anchor.x - zoomed.x) / zoomed.scale).toBeCloseTo((anchor.x - before.x) / before.scale, 2);
  expect((anchor.y - zoomed.y) / zoomed.scale).toBeCloseTo((anchor.y - before.y) / before.scale, 2);
  await page.mouse.wheel(0, 180);
  await expect.poll(async () => (await matrix()).scale).toBeCloseTo(before.scale, 3);

  await dialog.getByRole('button', { name: 'Centra albero' }).click();
  const node = dialog.getByRole('button', { name: /Miner D2.*bloccato/ });
  const nodeBounds = (await node.boundingBox())!;
  const start = await matrix();
  await page.mouse.move(nodeBounds.x + 30, nodeBounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(nodeBounds.x + 110, nodeBounds.y + 75, { steps: 6 });
  await page.mouse.up();
  const moved = await matrix();
  expect(moved.x - start.x).toBeCloseTo(80, 0);
  expect(moved.y - start.y).toBeCloseTo(45, 0);
  await expect(dialog.getByRole('heading', { name: /Miner S1/ })).toBeVisible();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('');
  await expect(dialog.locator('h1')).toHaveCSS('user-select', 'none');
  await expect(dialog).toHaveCSS('font-family', /Segoe UI/);

  await dialog.getByRole('button', { name: 'Centra albero' }).click();
  await dialog.getByRole('button', { name: /Miner H1.*bloccato/ }).click();
  await dialog.getByRole('button', { name: 'Sblocca Cyclone 200', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Cyclone 200' })).toBeVisible();
  await expect(
    dialog.getByRole('navigation').getByRole('button', { name: 'Ventole' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('anteprime HD solo ad albero aperto, coda sospesa alla chiusura e cache riutilizzata', async ({
  page,
}) => {
  const requested: string[] = [];
  let releaseModel!: () => void;
  const modelGate = new Promise<void>((resolve) => {
    releaseModel = resolve;
  });
  await page.route('**/assets/models/gpus/gpu-hybrid.glb', async (route) => {
    await modelGate;
    await route.continue();
  });
  page.on('request', (request) => {
    if (/gpu-(hybrid|liquid)\.glb/.test(request.url())) requested.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Albero della ricerca' })).toBeVisible();
  expect(requested).toHaveLength(0);
  await expect(page.locator('.detail-model img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Albero della ricerca' }).click();
  const dialog = page.getByRole('dialog');
  await expect.poll(() => requested.length).toBe(1);
  await page.keyboard.press('Escape');
  releaseModel();
  await page.waitForLoadState('networkidle');
  expect(requested).toHaveLength(1);
  await page.getByRole('button', { name: 'Albero della ricerca' }).click();
  await dialog.getByRole('button', { name: /Miner H1.*bloccato/ }).click();
  const image = dialog.locator('.detail-model img');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(768);
  expect(await image.evaluate((img: HTMLImageElement) => img.naturalHeight)).toBe(512);
  await expect(dialog.locator('.node-model img')).toHaveCount(12);
  const loaded = requested.length;
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Albero della ricerca' }).click();
  await expect(image).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(requested).toHaveLength(loaded);
});

test('albero utilizzabile su schermo stretto e senza anteprima disponibile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/assets/models/filters/*.glb', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Albero della ricerca' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('navigation').getByRole('button', { name: 'Filtri' }).click();
  await expect(dialog.getByRole('heading', { name: 'Filtro magnetico a rete' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Sblocca ricerca' })).toBeDisabled();
  await expect(dialog.locator('.detail-model app-icon')).toBeVisible();
  const viewport = (await dialog.locator('.tree-scroll').boundingBox())!;
  expect(viewport.width).toBe(390);
  expect(viewport.height).toBeGreaterThan(180);
  await dialog.getByRole('button', { name: 'Aumenta zoom' }).click();
  await dialog.getByRole('button', { name: 'Centra albero' }).click();
  await dialog.getByRole('button', { name: 'Tutto l’albero', exact: true }).click();
  await expect(dialog.locator('.research-node')).toHaveCount(39);
  const mapBounds = (await dialog.locator('.tree-scroll').boundingBox())!;
  const treeBounds = (await dialog.locator('.tree-canvas').boundingBox())!;
  expect(treeBounds.x).toBeGreaterThanOrEqual(mapBounds.x);
  expect(treeBounds.y).toBeGreaterThanOrEqual(mapBounds.y);
  expect(treeBounds.x + treeBounds.width).toBeLessThanOrEqual(mapBounds.x + mapBounds.width);
  expect(treeBounds.y + treeBounds.height).toBeLessThanOrEqual(mapBounds.y + mapBounds.height);
  await dialog.getByRole('button', { name: 'Chiudi albero della ricerca' }).click();
  await expect(dialog).not.toBeVisible();
});

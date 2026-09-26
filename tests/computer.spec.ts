import { expect, test, type Page } from '@playwright/test';
import type { GameService } from '../src/app/game/game.service';
import type { PerspectiveCamera, Scene } from 'three';

async function fund(page: Page): Promise<void> {
  await page.evaluate(() => {
    const debug = window as unknown as {
      ng: { getComponent(element: Element): { game: GameService } };
    };
    debug.ng
      .getComponent(document.querySelector('app-hud')!)
      .game.world.update((world) => ({ ...world, cashEur: 1000 }));
  });
}
async function openComputer(page: Page): Promise<void> {
  await page.goto('/');
  await page
    .getByRole('button', {
      name: (page.viewportSize()?.width ?? 1440) < 600 ? 'Apri computer' : 'Vai a Computer',
      exact: true,
    })
    .click();
  await expect(page.getByRole('dialog', { name: 'Computer del laboratorio' })).toBeVisible();
}

test('computer has two apps, research styling, keyboard exit and can reopen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openComputer(page);
  await expect(page.getByRole('button', { name: 'Apri Shop', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apri Magazzino', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCSS('font-family', /Segoe UI/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Vai a Computer', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(errors).toEqual([]);
});

test('buys quantities, updates wallet and stock, and does not permit locked hardware', async ({
  page,
}) => {
  await openComputer(page);
  await fund(page);
  await page.getByRole('button', { name: 'Apri Shop', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Categorie componenti' })
    .getByRole('button', { name: 'Schede video' })
    .click();
  const passive = page.locator('[data-product-id="gpu-passive"]');
  await passive.getByRole('spinbutton').fill('2');
  await passive.getByRole('button', { name: 'Aggiungi' }).click();
  await expect(
    page.locator('[data-product-id="gpu-dual"]').getByRole('button', { name: 'Aggiungi' }),
  ).toBeDisabled();
  const cart = page.getByRole('complementary', { name: 'Carrello' });
  await expect(cart).toContainText('130,00');
  await cart.getByRole('button', { name: 'Conferma ordine' }).click();
  await expect(page.getByRole('status')).toContainText('Ordine completato');
  await expect(passive).toContainText('In stock: 2');
  await expect(page.locator('.balance')).toContainText('870,00');
  await expect(cart).toContainText('Il carrello è vuoto');
  await expect(passive.getByRole('img')).toBeVisible();
  await page.screenshot({ path: 'test-results/computer-shop.png' });
  await page
    .getByRole('navigation', { name: 'Applicazioni' })
    .getByRole('button', { name: 'Magazzino' })
    .click();
  await page.getByLabel('Filtra stato inventario').selectOption('stock');
  await expect(page.locator('.inventory-row')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Vai a Computer', exact: true }).click();
  await expect(page.locator('.inventory-row')).toHaveCount(2);
});

test('insufficient funds, cart removal, search and empty inventory are usable', async ({
  page,
}) => {
  await openComputer(page);
  await page.getByRole('button', { name: 'Apri Shop', exact: true }).click();
  await page
    .locator('[data-product-id="gpu-passive"]')
    .getByRole('button', { name: 'Aggiungi' })
    .click();
  await expect(page.getByRole('button', { name: 'Conferma ordine' })).toBeDisabled();
  await expect(page.getByText('Mancano 65,00', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /Rimuovi una unità/ }).click();
  await expect(page.getByText('Il carrello è vuoto.')).toBeVisible();
  await page.getByRole('searchbox').fill('inesistente');
  await expect(page.getByRole('heading', { name: 'Nessun componente trovato' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Applicazioni' })
    .getByRole('button', { name: 'Magazzino' })
    .click();
  await page.getByLabel('Filtra stato inventario').selectOption('stock');
  await expect(page.getByRole('heading', { name: 'Nessun componente', exact: true })).toBeVisible();
});

test('broken GPU details stay visible through removal and confirmed resale', async ({ page }) => {
  await openComputer(page);
  await page.evaluate(() => {
    const debug = window as unknown as {
      ng: { getComponent(element: Element): { game: GameService } };
    };
    debug.ng.getComponent(document.querySelector('app-hud')!).game.world.update((world) => ({
      ...world,
      plots: world.plots.map((plot) => ({
        ...plot,
        rigs: plot.rigs.map((rig) => ({
          ...rig,
          gpus: rig.gpus.map((gpu) =>
            gpu.id === 1
              ? { ...gpu, wearPercent: 100, stopped: true, stopReason: 'GPU usurata' }
              : gpu,
          ),
        })),
      })),
    }));
  });
  await page.getByRole('button', { name: 'Apri Magazzino', exact: true }).click();
  await page.getByLabel('Filtra stato inventario').selectOption('broken');
  await expect(page.locator('.inventory-row')).toHaveCount(1);
  const detail = page.getByRole('complementary', { name: 'Dettagli componente' });
  await expect(detail).toContainText('100.0%');
  await detail.getByRole('button', { name: 'Sposta in magazzino' }).click();
  await expect(detail).toContainText('In magazzino');
  await page.screenshot({ path: 'test-results/computer-inventory.png' });
  await detail.getByRole('button', { name: /Vendi come ricambi/ }).click();
  await detail.getByRole('button', { name: 'Annulla' }).click();
  await expect(page.locator('.inventory-row')).toHaveCount(1);
  await detail.getByRole('button', { name: /Vendi come ricambi/ }).click();
  await detail.getByRole('button', { name: 'Conferma vendita' }).click();
  await expect(page.getByRole('heading', { name: 'Nessuna GPU guasta' })).toBeVisible();
  await expect(page.locator('.balance')).toContainText('6,50');
});

test('mobile keeps catalog and order controls within the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openComputer(page);
  await fund(page);
  await page.getByRole('button', { name: 'Apri Shop', exact: true }).click();
  await page.getByRole('searchbox').fill('passive');
  await page
    .locator('[data-product-id="gpu-passive"]')
    .getByRole('button', { name: 'Aggiungi' })
    .click();
  await page.getByRole('button', { name: 'Conferma ordine' }).click();
  await expect(page.getByRole('status')).toContainText('Ordine completato');
  expect(
    await page
      .getByRole('dialog')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: 'test-results/computer-mobile.png' });
});

test('computer GLB is available in the model library', async ({ page }) => {
  await page.goto('/?models=1&model=computer');
  await expect(page.getByRole('heading', { name: 'PC del laboratorio' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('Caricamento modello')).toBeHidden();
  await page.screenshot({ path: 'test-results/computer-model.png' });
});

test('computer in the Tools area opens by clicking its 3D monitor', async ({ page }) => {
  await openComputer(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Escape');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const debug = window as unknown as {
          ng: { getComponent(element: Element): { scene?: { scene: Scene } } };
        };
        return !!debug.ng
          .getComponent(document.querySelector('app-scene')!)
          .scene?.scene.getObjectByName('computer');
      }),
    )
    .toBe(true);
  let point: { x: number; y: number } | null = null;
  await expect
    .poll(async () => {
      point = await page.evaluate(() => {
        const debug = window as unknown as {
          ng: {
            getComponent(element: Element): { scene: { scene: Scene; camera: PerspectiveCamera } };
          };
        };
        const view = debug.ng.getComponent(document.querySelector('app-scene')!).scene;
        const computer = view.scene.getObjectByName('computer')!;
        view.scene.updateMatrixWorld(true);
        view.camera.updateMatrixWorld(true);
        const position = computer.getWorldPosition(computer.position.clone());
        position.x -= 0.52;
        position.y += 2.84;
        position.z -= 0.477;
        position.project(view.camera);
        const canvas = document.querySelector('app-scene canvas')!.getBoundingClientRect();
        const x = canvas.left + ((position.x + 1) * canvas.width) / 2;
        const y = canvas.top + ((1 - position.y) * canvas.height) / 2;
        return document.elementFromPoint(x, y)?.tagName === 'CANVAS' ? { x, y } : null;
      });
      return point !== null;
    })
    .toBe(true);
  await page.screenshot({ path: 'test-results/computer-tools.png' });
  await page.mouse.click(point!.x, point!.y);
  await expect(page.getByRole('dialog', { name: 'Computer del laboratorio' })).toBeVisible();
});

test('purchased GPU mounts into a freed slot with its own 3D model and specifications', async ({
  page,
}) => {
  await openComputer(page);
  await fund(page);
  await page.evaluate(() => {
    const debug = window as unknown as {
      ng: { getComponent(element: Element): { game: GameService } };
    };
    debug.ng.getComponent(document.querySelector('app-hud')!).game.unlockResearch('gpu-compact');
  });
  await page.getByRole('button', { name: 'Apri Shop', exact: true }).click();
  await page.getByRole('searchbox').fill('compact');
  await page
    .locator('[data-product-id="gpu-compact"]')
    .getByRole('button', { name: 'Aggiungi' })
    .click();
  await page.getByRole('button', { name: 'Conferma ordine' }).click();
  await page
    .getByRole('navigation', { name: 'Applicazioni' })
    .getByRole('button', { name: 'Magazzino' })
    .click();
  await page.getByLabel('Filtra stato inventario').selectOption('installed');
  await page
    .getByRole('navigation', { name: 'Categorie componenti' })
    .getByRole('button', { name: 'Schede video' })
    .click();
  await page.locator('.inventory-row').first().click();
  await page.getByRole('button', { name: 'Sposta in magazzino' }).click();
  await page.getByLabel('Filtra stato inventario').selectOption('stock');
  await page.getByRole('searchbox').fill('compact');
  await page.getByRole('button', { name: 'Monta GPU' }).click();
  await expect(page.getByRole('status')).toContainText('GPU montata');
  await expect(page.locator('.inventory-row')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const debug = window as unknown as {
          ng: { getComponent(element: Element): { game: GameService; scene: { scene: Scene } } };
        };
        const { game, scene } = debug.ng.getComponent(document.querySelector('app-scene')!);
        return {
          model: game.gpuTelemetry(1).model,
          mesh: !!scene.scene.getObjectByName('gpu-1')?.getObjectByName('gpu-compact'),
        };
      }),
    )
    .toEqual({ model: 'Miner S1 · Compact', mesh: true });
});

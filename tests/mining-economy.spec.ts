import { expect, test } from '@playwright/test';
import type { GameService } from '../src/app/game/game.service';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('complementary', { name: 'Portafoglio Bitcoin' })).toBeVisible();
});

test('animates the electricity debit and ends on the committed net wallet balance', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluate(() => {
    const debug = window as unknown as {
      ng: { getComponent(element: Element): { game: GameService } };
    };
    const game = debug.ng.getComponent(document.querySelector('app-hud')!).game;
    game.world.update((world) => ({
      ...world,
      blocks: [{ id: 1, progress: 99.9 }],
      electricity: { energyKwh: 100, pendingKwh: 100, paidSatoshis: 0 },
      plots: world.plots.map((plot) => ({
        ...plot,
        rigs: plot.rigs.map((rig) => ({
          ...rig,
          gpus: rig.gpus.map((gpu) => ({ ...gpu, unlocked: gpu.id === 1 })),
        })),
      })),
    }));
  });
  await page
    .getByRole('textbox', { name: 'Codice MineScript' })
    .fill('plots[0].rigs[0].gpus[0].mine();');
  await page.getByRole('button', { name: 'Avvia codice', exact: true }).click();
  const receipt = page.getByRole('status', { name: 'Riepilogo mining' });
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText('100.20 kWh');
  await expect(page.locator('app-wallet .bitcoin-counter')).toHaveClass(/debit/);
  await page.screenshot({ path: 'test-results/mining-settlement.png' });
  await expect(page.locator('app-wallet .wallet-amount b')).toHaveText(/569,94/);
  await expect(page.locator('app-wallet .wallet-amount strong')).toHaveText('0.00949897 BTC');
  const result = await page.evaluate(() => {
    const debug = window as unknown as {
      ng: { getComponent(element: Element): { game: GameService } };
    };
    const game = debug.ng.getComponent(document.querySelector('app-hud')!).game;
    return {
      balance: game.world().satoshis,
      paid: game.world().electricity.paidSatoshis,
      pending: game.world().electricity.pendingKwh,
    };
  });
  expect(result).toEqual({ balance: 949897, paid: 50103, pending: 0 });
  expect(errors).toEqual([]);
});

test('shows only the selected GPU in a rig and controls its stop through code', async ({
  page,
}) => {
  await page.locator('app-power .power-panel > summary').click();
  await expect(page.locator('app-power .gpu-empty')).toBeVisible();
  await expect(page.locator('app-power .gpu-heading')).toHaveCount(0);
  await expect(page.locator('app-power button')).toHaveCount(0);
  await page.evaluate(() => {
    const debug = window as unknown as {
      ng: { getComponent(element: Element): { game: GameService } };
    };
    const game = debug.ng.getComponent(document.querySelector('app-hud')!).game;
    game.world.update((world) => ({
      ...world,
      plots: world.plots.map((plot) => ({
        ...plot,
        rigs: plot.rigs.map((rig) => ({
          ...rig,
          gpus: rig.gpus.map((gpu) => (gpu.id === 2 ? { ...gpu, unlocked: true } : gpu)),
        })),
      })),
    }));
  });
  await page
    .getByRole('textbox', { name: 'Codice MineScript' })
    .fill(
      'plots[0].rigs[0].gpus[0].setFrequencyGhz(1.2); let second = plots[0].rigs[0].gpus[1]; second.setFrequencyGhz(2.2); second.stop();',
    );
  await page.getByRole('button', { name: 'Avvia codice', exact: true }).click();
  await page.getByRole('button', { name: 'GPU 001 sbloccata', exact: true }).click();
  await expect(page.locator('app-power .gpu-heading')).toHaveText(/GPU 1\s*PRONTA/);
  await expect(
    page.locator('app-power .meter-row').filter({ hasText: 'Frequenza impostata' }),
  ).toContainText('1.20 GHz');
  await page.getByRole('button', { name: 'GPU 002 sbloccata', exact: true }).click();
  await expect(page.locator('app-power .gpu-heading')).toHaveText(/GPU 2\s*FERMA/);
  await expect(page.locator('app-power .gpu-context')).toContainText('Rig 1 · Plot 1');
  await expect(
    page.locator('app-power .meter-row').filter({ hasText: 'Frequenza impostata' }),
  ).toContainText('2.20 GHz');
  await expect(
    page.locator('app-power .meter-row').filter({ hasText: 'Consumo GPU' }),
  ).toContainText('0 W');
  await page
    .getByRole('textbox', { name: 'Codice MineScript' })
    .fill('plots[0].rigs[0].gpus[0].mine();');
  await page.getByRole('button', { name: 'Avvia codice', exact: true }).click();
  await expect(page.locator('app-power .gpu-heading')).toHaveText(/GPU 2\s*FERMA/);
  await expect(page.getByRole('button', { name: 'Avvia codice', exact: true })).toBeEnabled();
  await expect(page.locator('app-power .gpu-heading')).toContainText('FERMA');
  await page
    .getByRole('textbox', { name: 'Codice MineScript' })
    .fill('plots[0].rigs[0].gpus[1].clearStop();');
  await page.getByRole('button', { name: 'Avvia codice', exact: true }).click();
  await expect(page.locator('app-power .gpu-heading')).toHaveText(/GPU 2\s*PRONTA/);
  await expect(
    page.locator('app-power .meter-row').filter({ hasText: 'Consumo GPU' }),
  ).toContainText('32 W');
  await page.screenshot({ path: 'test-results/selected-gpu-hud.png' });
  await page.locator('app-power .power-panel > summary').click();
  await page.getByRole('button', { name: 'Visualizza Rig 1', exact: true }).click();
  await page.locator('app-power .power-panel > summary').click();
  await expect(page.locator('app-power .gpu-empty')).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Codice MineScript' })
    .fill('plots[0].rigs[0].gpus[0].mine();');
  await page.getByRole('button', { name: 'Avvia codice', exact: true }).click();
  await expect(page.locator('app-power .gpu-empty')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Avvia codice', exact: true })).toBeEnabled();
  await expect(page.locator('app-power .gpu-heading')).toHaveCount(0);
});

test('documents energy, overclock and stop methods in the in-game manual', async ({ page }) => {
  await page.getByRole('button', { name: 'Manuale e tutorial', exact: true }).click();
  await page.getByRole('tab', { name: 'Corrente', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Corrente e portafoglio', exact: true }),
  ).toBeVisible();
  await expect(page.locator('#guide-page-energy')).toContainText('electricity.getPendingCostEur()');
  await page.getByRole('tab', { name: 'GPU', exact: true }).click();
  await expect(page.locator('#guide-page-gpu')).toContainText('gpu.getAbsoluteMaxFrequencyGhz()');
  await expect(page.locator('#guide-page-gpu')).toContainText('gpu.getWearPercent()');
  await expect(page.locator('#guide-page-gpu')).toContainText('gpu.clearStop();');
});

test('keeps wallet and controls usable on mobile with reduced motion', async ({ page }) => {
  await page.getByRole('button', { name: 'GPU 001 sbloccata', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const wallet = await page.locator('app-wallet').boundingBox();
  const editor = await page.locator('.editor-window').boundingBox();
  expect(wallet!.y + wallet!.height).toBeLessThan(editor!.y);
  await page.locator('app-power .power-panel > summary').click();
  await expect(page.getByRole('region', { name: 'Specifiche GPU selezionata' })).toBeVisible();
  await expect(page.locator('app-power .gpu-heading')).toHaveText(/GPU 1\s*PRONTA/);
  await expect(page.locator('app-power button')).toHaveCount(0);
  await page.locator('app-power .gpu-limits summary').click();
  await expect(page.locator('app-power .gpu-limits')).toContainText('2.60 GHz');
  await page.screenshot({ path: 'test-results/mining-mobile.png' });
});

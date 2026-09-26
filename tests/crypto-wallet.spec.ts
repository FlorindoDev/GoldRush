import { expect, test } from '@playwright/test';
import type { GameService } from '../src/app/game/game.service';

test('wallet shows mixed holdings with model icons and opens by keyboard on desktop and mobile', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const wallet = page.getByRole('complementary', { name: 'Portafoglio', exact: true });
  const toggle = wallet.getByRole('button', { name: /PORTAFOGLIO/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle.locator('app-icon[name="wallet"]')).toBeVisible();
  await toggle.click();
  await expect(wallet).toContainText('Nessuna cripto');
  await toggle.click();
  await page.evaluate(() => {
    const debug = window as unknown as {
      ng: { getComponent(element: Element): { game: GameService } };
    };
    const game = debug.ng.getComponent(document.querySelector('app-hud')!).game;
    game.world.update((world) => ({ ...world, blocks: [{ id: 1, progress: 99.9 }] }));
  });
  await page
    .getByRole('textbox', { name: 'Codice MineScript' })
    .fill(
      'let gpus = plots[0].rigs[0].gpus; setCrypto(gpus.slice(0, 2), "KAS"); setCrypto(gpus.slice(2, 4), "LTC"); mine();',
    );
  await page.getByRole('button', { name: 'Avvia codice', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Riepilogo mining' })).toBeVisible();
  await expect(toggle).toContainText('600,00');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(wallet.locator('.crypto-row')).toHaveCount(3);
  for (const symbol of ['BTC', 'KAS', 'LTC']) {
    const row = wallet.locator('.crypto-row').filter({ hasText: symbol });
    await expect(row.locator('canvas')).toBeVisible();
    await expect(row.locator('.crypto-value')).toContainText('€');
  }
  await expect(wallet.locator('app-crypto-model .fallback')).toHaveCount(0);
  const walletBox = await wallet.boundingBox();
  const powerBox = await page.locator('app-power .power-panel').first().boundingBox();
  expect(Math.abs(walletBox!.y - powerBox!.y)).toBeLessThan(2);
  await page.screenshot({ path: 'test-results/crypto-wallet-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(wallet.locator('.wallet-assets')).toBeVisible();
  const assetsBox = await wallet.locator('.wallet-assets').boundingBox();
  expect(assetsBox!.x).toBeGreaterThanOrEqual(0);
  expect(assetsBox!.x + assetsBox!.width).toBeLessThanOrEqual(390);
  expect(
    await wallet
      .locator('.crypto-row')
      .first()
      .evaluate((row) => {
        const box = row.getBoundingClientRect();
        return row.contains(
          document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
        );
      }),
  ).toBe(true);
  await page.screenshot({ path: 'test-results/crypto-wallet-mobile.png' });
  await toggle.click();
  await expect(wallet.locator('.wallet-assets')).toBeHidden();
  expect(errors).toEqual([]);
});

import { expect, test } from '@playwright/test';

test('pause keeps the workspace usable and resized windows visible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Metti in pausa il gioco' }).click();

  await expect(page.locator('.pause-notice')).toContainText('Gioco in pausa');
  const clock = page.locator('.game-clock time');
  const frozenTime = await clock.textContent();
  await page.waitForTimeout(500);
  await expect(clock).toHaveText(frozenTime ?? '');

  await page.getByRole('button', { name: 'Svuota console' }).click();
  await expect(page.getByText('Console vuota. Pronta per nuove istruzioni.')).toBeVisible();

  const editorHeading = page.locator('.editor-window .panel-heading');
  const heading = await editorHeading.boundingBox();
  expect(heading).not.toBeNull();
  await page.mouse.move(heading!.x + 55, heading!.y + 20);
  await page.mouse.down();
  await page.mouse.move(1220, 900, { steps: 5 });
  await page.mouse.up();

  await page.setViewportSize({ width: 375, height: 500 });
  const bounds = await page.locator('.floating-window:visible').evaluateAll((windows) =>
    windows.map((window) => {
      const rect = window.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    }),
  );
  expect(bounds).toHaveLength(2);
  for (const rect of bounds) {
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(375);
    expect(rect.bottom).toBeLessThanOrEqual(500);
  }

  await page.getByRole('button', { name: 'Riprendi il gioco' }).click();
  await expect(page.locator('.pause-notice')).toHaveCount(0);
});

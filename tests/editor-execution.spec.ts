import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('wraps long script lines and keeps line numbers aligned', async ({ page }) => {
  const editor = page.getByRole('region', { name: 'Editor del codice' });
  const code = editor.getByRole('textbox', { name: 'Codice MineScript' });
  await code.fill(`print("${'gpu-code-'.repeat(18)}");\nprint("second line");`);

  await expect(code).toHaveAttribute('wrap', 'soft');
  const rows = editor.locator('.code-highlight .code-line');
  await expect(rows.locator('.line-number')).toHaveText(['1', '2']);
  const dimensions = await rows.evaluateAll((elements) =>
    elements.map((element) => {
      const { top, height } = element.getBoundingClientRect();
      return { top, height };
    }),
  );

  expect(dimensions[0].height).toBeGreaterThan(25);
  expect(dimensions[1].top).toBeCloseTo(dimensions[0].top + dimensions[0].height, 0);
  await expect(rows.nth(1)).toHaveCSS('line-height', '25px');

  const gutter = await rows.first().locator('.line-number').boundingBox();
  const input = await code.boundingBox();
  expect(gutter!.x + gutter!.width).toBeCloseTo(input!.x, 0);
  const textPositions = await editor.locator('.code-content').evaluate((element) => {
    const input = element.querySelector('textarea')!;
    const content = element.querySelector('.line-content')!;
    return {
      input: input.getBoundingClientRect().left + parseFloat(getComputedStyle(input).paddingLeft),
      highlight:
        content.getBoundingClientRect().left + parseFloat(getComputedStyle(content).paddingLeft),
    };
  });
  expect(textPositions.highlight).toBeCloseTo(textPositions.input, 0);
});

test('keeps the gutter aligned while typing and scrolling to the current line', async ({
  page,
}) => {
  const editor = page.getByRole('region', { name: 'Editor del codice' });
  const code = editor.getByRole('textbox', { name: 'Codice MineScript' });
  await code.fill(Array.from({ length: 80 }, (_, index) => `print(${index + 1});`).join('\n'));
  await code.press('Control+Home');
  await code.press('ArrowDown');
  await expect(editor.locator('.cursor-line .line-number')).toHaveText('2');
  await code.press('End');
  await code.pressSequentially(' // updated');
  await expect(editor.locator('.cursor-line .line-content')).toContainText('print(2); // updated');

  await code.press('Control+End');
  await expect(editor.locator('.cursor-line .line-number')).toHaveText('80');
  await expect
    .poll(() =>
      editor.locator('.code-content').evaluate((element) => {
        const input = element.querySelector('textarea')!;
        const overlay = element.querySelector('.code-highlight')!;
        return input.scrollTop > 0 && Math.abs(input.scrollTop - overlay.scrollTop) < 1;
      }),
    )
    .toBe(true);
  const lastNumber = await editor.locator('.cursor-line .line-number').boundingBox();
  const input = await code.boundingBox();
  expect(lastNumber!.x + lastNumber!.width).toBeCloseTo(input!.x, 0);
  const numberText = await editor.locator('.cursor-line .line-number').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const { top, bottom } = range.getBoundingClientRect();
    return { top, bottom };
  });
  expect(numberText.top).toBeGreaterThanOrEqual(input!.y);
  expect(numberText.bottom).toBeLessThanOrEqual(input!.y + input!.height);
});

test('shows which source line is executing', async ({ page }) => {
  const editor = page.getByRole('region', { name: 'Editor del codice' });
  await editor.getByRole('textbox', { name: 'Codice MineScript' }).fill('wait(500);');
  await editor.getByRole('button', { name: 'Esegui una riga' }).click();

  await expect(editor.locator('.editor-status')).toContainText('Riga 1 in esecuzione');
  await expect(editor.locator('.code-highlight .code-line.active-line')).toContainText(
    'wait(500);',
  );
  await expect(editor.locator('.code-highlight .code-line.executed-line')).toHaveCount(1);
});

test('steps through MineScript and can resume the rest of the program', async ({ page }) => {
  const editor = page.getByRole('region', { name: 'Editor del codice' });
  const code = editor.getByRole('textbox', { name: 'Codice MineScript' });
  const log = page.getByRole('log', { name: 'Messaggi del programma' });

  await code.fill('print("uno");\nprint("due");\nprint("tre");');
  await editor.getByRole('button', { name: 'Esegui una riga' }).click();
  await expect(editor.locator('.editor-status')).toContainText('In pausa dopo riga 1');
  await expect(log).toContainText('uno');
  await expect(editor.locator('.code-highlight .executed-line')).toContainText('print("uno");');

  await editor.getByRole('button', { name: 'Esegui una riga' }).click();
  await expect(editor.locator('.editor-status')).toContainText('In pausa dopo riga 2');
  await expect(log).toContainText('due');

  await editor.getByRole('button', { name: 'Continua esecuzione' }).click();
  await expect(editor.locator('.editor-status')).not.toContainText('In pausa');
  await expect(log).toContainText('tre');
  await expect(editor.locator('.code-highlight .executed-line')).toHaveCount(3);
});

test('line animation preference persists from settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Impostazioni' }).click();
  const effects = page.getByRole('checkbox', { name: /Animazione riga eseguita/ });
  await expect(effects).toBeChecked();
  await effects.uncheck();
  await page.getByRole('button', { name: 'Chiudi impostazioni' }).click();

  await page.reload();
  await page.getByRole('button', { name: 'Impostazioni' }).click();
  await expect(page.getByRole('checkbox', { name: /Animazione riga eseguita/ })).not.toBeChecked();
  await page.getByRole('button', { name: 'Chiudi impostazioni' }).click();

  const editor = page.getByRole('region', { name: 'Editor del codice' });
  await editor.getByRole('textbox', { name: 'Codice MineScript' }).fill('print("senza effetto");');
  await editor.getByRole('button', { name: 'Avvia codice' }).click();
  await expect(page.getByRole('log', { name: 'Messaggi del programma' })).toContainText(
    'senza effetto',
  );
  await expect(editor.locator('.code-highlight .executed-line')).toHaveCount(0);
});

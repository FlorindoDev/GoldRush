import { expect, it } from 'vitest';
import { highlight } from './highlight';

it('escapes script contents instead of inserting user HTML', () => {
  const output = highlight('print("<img src=x onerror=alert(1)>"); // <script>');
  expect(output).not.toContain('<img');
  expect(output).not.toContain('<script>');
  expect(output).toContain('&lt;img');
  expect(output).toContain('token-string');
});

it('marks the currently executed line and refreshes repeated line animations', () => {
  const source = 'print(1);\nprint(2);';
  const first = highlight(source, { executedLines: new Map([[2, 4]]) });
  const repeated = highlight(source, { executedLines: new Map([[2, 5]]) });

  expect(first).toContain(
    'class="code-line executed-line execution-4"><span class="line-number">2</span>',
  );
  expect(repeated).toContain(
    'class="code-line executed-line execution-5"><span class="line-number">2</span>',
  );
  expect(first.indexOf('executed-line')).toBeGreaterThan(first.indexOf('print(1)'));
});

it('omits the execution box when line effects are disabled', () => {
  const output = highlight('print(1);', {
    executedLines: new Map([[1, 1]]),
    effectsEnabled: false,
  });

  expect(output).not.toContain('executed-line');
});

import { expect, it } from 'vitest';
import { highlight } from './highlight';

it('escapes script contents instead of inserting user HTML', () => {
  const output = highlight('print("<img src=x onerror=alert(1)>"); // <script>');
  expect(output).not.toContain('<img');
  expect(output).not.toContain('<script>');
  expect(output).toContain('&lt;img');
  expect(output).toContain('token-string');
});

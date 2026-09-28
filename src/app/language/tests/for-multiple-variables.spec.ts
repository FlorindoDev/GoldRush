import { expect, it } from 'vitest';
import { execute } from '../interpreter';
import { parse } from '../parser';

async function run(source: string): Promise<string[]> {
  const output: string[] = [];
  await execute(
    source,
    { print: (message) => output.push(message), progress: () => 0 },
    new AbortController().signal,
  );
  return output;
}

it('declares multiple for variables and updates them left to right', async () => {
  const output = await run(`
for (let i = 0, j = i + 5; i < j; i++, j--) {
  print(i + ":" + j);
}
print(i);
print(j);
`);
  expect(output).toEqual(['0:5', '1:4', '2:3', '3', '2']);
});

it('supports multiple assignments without let in both for clauses', async () => {
  const output = await run(`
let i = 10;
let sum = 0;
for (i = 0, sum = 1; i < 3; i++, sum = sum + i) {}
print(i);
print(sum);
`);
  expect(output).toEqual(['3', '7']);
});

it('keeps one-variable for loops valid and rejects incomplete lists', () => {
  expect(parse('for (let i = 0; i < 2; i++) {}')[0].kind).toBe('for');
  expect(() => parse('for (let i = 0,; i < 2; i++) {}')).toThrow();
  expect(() => parse('for (let i = 0; i < 2; i++,) {}')).toThrow();
});

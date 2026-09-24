import { describe, expect, it, vi } from 'vitest';
import { delay, execute, ScriptHost } from './interpreter';
import type { ScriptObject } from './syntax';
import { parse } from './parser';

function fixture() {
  let progress = 0;
  const output: string[] = [];
  const mine = vi.fn(async () => {
    progress = Math.min(progress + 20, 100);
  });
  const gpu: ScriptObject = {
    objectType: 'GPU',
    getAttribute: () => null,
    callMethod: async (name) => {
      if (name !== 'mine') {
        throw new Error(`metodo "${name}" non disponibile per una GPU.`);
      }
      await mine();
      return null;
    },
    toDisplayString: () => 'GPU',
  };
  const host: ScriptHost = {
    globals: { gpu },
    print: (message) => output.push(message),
    progress: () => progress,
  };
  const controller = new AbortController();
  return {
    mine,
    output,
    host,
    controller,
    run: (source: string) => execute(source, host, controller.signal),
  };
}

describe('MineScript', () => {
  it('executes repeat and reports progress in order', async () => {
    const f = fixture();
    await f.run('repeat (5) { gpu.mine(); } print(progress());');
    expect(f.mine).toHaveBeenCalledTimes(5);
    expect(f.output).toEqual(['100']);
  });

  it('handles for, increment, variables and operator precedence', async () => {
    const f = fixture();
    await f.run('let n = 2 + 1 * 3; for (let i = 0; i < n; i++) { gpu.mine(); } print(i);');
    expect(f.mine).toHaveBeenCalledTimes(5);
    expect(f.output).toEqual(['5']);
  });

  it('uses the live progress in while and supports if/else', async () => {
    const f = fixture();
    await f.run(
      'while (progress() < 100) { gpu.mine(); } if (progress() == 100) { print("ok"); } else { print("no"); }',
    );
    expect(f.output).toEqual(['ok']);
    expect(f.mine).toHaveBeenCalledTimes(5);
  });

  it('supports nested loops, comments and escaped strings', async () => {
    const f = fixture();
    await f.run('// gpu.mine();\nrepeat(2) { repeat(2) { gpu.mine(); } } print("a\\\"b");');
    expect(f.mine).toHaveBeenCalledTimes(4);
    expect(f.output).toEqual(['a"b']);
  });

  it('short-circuits logical conditions', async () => {
    const f = fixture();
    await f.run(
      'if (false && gpu.mine()) { print("no"); } if (true || gpu.mine()) { print("yes"); }',
    );
    expect(f.mine).not.toHaveBeenCalled();
    expect(f.output).toEqual(['yes']);
  });

  it.each([
    'repeat(-1) {}',
    'repeat(1.5) {}',
    'repeat(1001) {}',
    'wait(-1);',
    'wait(5001);',
    'mine(1);',
    'print();',
    'unknown();',
    'x = 2;',
    'print(1/0);',
    'print(1%0);',
    'print("a" - 1);',
  ])('rejects invalid program: %s', async (source) => {
    await expect(fixture().run(source)).rejects.toThrow('Riga 1:');
  });

  it('reports the correct syntax error line before any mining', async () => {
    const f = fixture();
    await expect(f.run('gpu.mine();\nrepeat (5) {\n gpu.mine()\n}')).rejects.toThrow('Riga 4:');
    expect(f.mine).not.toHaveBeenCalled();
  });

  it('rejects browser APIs and excessive nesting', () => {
    expect(() => parse('window.alert("hello");')).toThrow('carattere non riconosciuto');
    expect(() => parse('repeat(1){'.repeat(80) + '}'.repeat(80))).toThrow('annidamento');
  });

  it('stops an infinite loop at the instruction budget', async () => {
    await expect(fixture().run('while(true) {}')).rejects.toThrow('10.000 operazioni');
  });

  it('allows cancellation while waiting without executing subsequent calls', async () => {
    const f = fixture();
    const running = f.run('wait(5000); gpu.mine();');
    setTimeout(() => f.controller.abort(), 10);
    await expect(running).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.mine).not.toHaveBeenCalled();
  });

  it('allows cancellation of loops with no mining', async () => {
    const f = fixture();
    const running = f.run('while(true) {}');
    setTimeout(() => f.controller.abort(), 5);
    await expect(running).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('resets variables between executions', async () => {
    const f = fixture();
    await f.run('let a = 1;');
    await expect(f.run('print(a);')).rejects.toThrow('non definita');
  });

  it('does not schedule an already aborted delay', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => delay(100, controller.signal)).toThrow();
  });
});

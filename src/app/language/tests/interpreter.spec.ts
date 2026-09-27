import { describe, expect, it, vi } from 'vitest';
import { GAME_BALANCE } from '../../config/game-balance';
import { createWorld, GPUS_PER_RIG, PLOT_COUNT, RIGS_PER_PLOT } from '../../game/mining-world';
import { PlotScriptObject } from '../../game/script-api/plot-script-object';
import type { GpuScriptControls } from '../../game/script-api/gpu-script-object';
import { VectorValue } from '../collections/vector';
import { GUIDE_CODE } from '../guide-code';
import { delay, execute, ScriptHost } from '../interpreter';
import { parse } from '../parser';

function fixture() {
  let progress = 0;
  const output: string[] = [];
  const mine = vi.fn(async () => {
    progress = Math.min(progress + 20, 100);
  });
  const host: ScriptHost = {
    mine,
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
    await f.run('repeat (5) { mine(); } print(progress());');
    expect(f.mine).toHaveBeenCalledTimes(5);
    expect(f.output).toEqual(['100']);
  });

  it('handles for, increment, variables and operator precedence', async () => {
    const f = fixture();
    await f.run('let n = 2 + 1 * 3; for (let i = 0; i < n; i++) { mine(); } print(i);');
    expect(f.mine).toHaveBeenCalledTimes(5);
    expect(f.output).toEqual(['5']);
  });

  it('calls a function with a local parameter and returns its result', async () => {
    const f = fixture();
    await f.run('def doppio(numero) { return numero * 2; } print(doppio(3));');
    expect(f.output).toEqual(['6']);
  });

  it('passes vectors, stacks and queues into functions by reference', async () => {
    const f = fixture();
    await f.run(`
def aggiungi(vettore) { vettore.push(8); return vettore; }
def sposta(pila, coda) { coda.enqueue(pila.pop()); }
let valori = vector();
let pila = stack();
let coda = queue();
pila.push(aggiungi(valori));
sposta(pila, coda);
print(valori[0]);
print(pila.size());
print(coda.length());
print(coda.peek()[0]);
`);
    expect(f.output).toEqual(['8', '0', '1', '8']);
    f.output.length = 0;
    await f.run(GUIDE_CODE.collectionParameters);
    expect(f.output).toEqual(['1', '8']);
  });

  it('reads plot, rig and GPU vector sizes inside user functions', async () => {
    const f = fixture();
    const world = createWorld();
    const controls = {
      getGpu: (id: number) =>
        world.plots
          .flatMap((plot) => plot.rigs)
          .flatMap((rig) => rig.gpus)
          .find((gpu) => gpu.id === id)!,
    } as GpuScriptControls;
    f.host.globals = {
      plots: new VectorValue(
        world.plots.map((plot) => new PlotScriptObject(plot, controls)),
        true,
      ),
    };
    await f.run(`
def misura(elementi) { return elementi.size(); }
def leggiId(oggetto) { return oggetto.id; }
print(misura(plots));
print(misura(plots[0].rigs));
print(misura(plots[0].rigs[0].gpus));
print(leggiId(plots[0]));
print(leggiId(plots[0].rigs[0]));
print(leggiId(plots[0].rigs[0].gpus[0]));
print(plots.length());
print(plots[0].rigs.length);
print(plots[0].rigs[0].gpus.size);
`);
    expect(f.output).toEqual([
      String(PLOT_COUNT),
      String(RIGS_PER_PLOT),
      String(GPUS_PER_RIG),
      '1',
      '1',
      '1',
      String(PLOT_COUNT),
      String(RIGS_PER_PLOT),
      String(GPUS_PER_RIG),
    ]);
    await expect(f.run('plots.size(1);')).rejects.toThrow('size richiede 0 argomenti');
  });

  it('runs user functions concurrently inside parallel', async () => {
    const f = fixture();
    let active = 0;
    let peak = 0;
    f.host.mine = vi.fn(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active--;
    });
    await f.run(`
def lavora(gruppo) { mine(gruppo); }
let primo = vector();
let secondo = vector();
parallel { lavora(primo); lavora(secondo); }
`);
    expect(f.host.mine).toHaveBeenCalledTimes(2);
    expect(peak).toBe(2);
    const calls = vi.mocked(f.host.mine!).mock.calls;
    expect(calls[0][0]).not.toBe(calls[1][0]);
    expect(calls[0][3]).toBe(calls[1][3]);
  });

  it('imports and runs every function from the guide example', async () => {
    const f = fixture();
    f.host.entryFileName = 'main.mine';
    f.host.modules = { 'utilita.mine': GUIDE_CODE.fileLibrary };

    await f.run(GUIDE_CODE.fileImport);
    expect(f.output).toEqual(['6', '9']);

    f.output.length = 0;
    await f.run(GUIDE_CODE.fileImportSelected);
    expect(f.output).toEqual(['6']);

    f.output.length = 0;
    await f.run('import { doppio, triplo } from "utilita.mine"; print(triplo(doppio(2)));');
    expect(f.output).toEqual(['12']);

    f.output.length = 0;
    await f.run('import "utilita.mine"; print(triplo(4));');
    expect(f.output).toEqual(['12']);
  });

  it('imports selected functions without exposing their private helpers', async () => {
    const f = fixture();
    f.host.modules = {
      'utilita.mine': 'def doppio(n) { return aiuto(n) * 2; } def aiuto(n) { return n + 1; }',
    };

    await f.run('import { doppio } from "utilita.mine"; print(doppio(3));');
    expect(f.output).toEqual(['8']);
    await expect(f.run('import { doppio } from "utilita.mine"; print(aiuto(3));')).rejects.toThrow(
      'funzione "aiuto" sconosciuta.',
    );
    await expect(f.run('import { mancante } from "utilita.mine";')).rejects.toThrow(
      'funzione "mancante" non trovata',
    );
  });

  it('supports imports through another library without starting its code', async () => {
    const f = fixture();
    f.host.modules = {
      'base.mine': 'def base(n) { return n + 1; }',
      'utilita.mine': 'import { base } from "base.mine"; def doppio(n) { return base(n) * 2; }',
    };

    await f.run('import { doppio } from "utilita.mine"; print(doppio(3));');
    expect(f.output).toEqual(['8']);
    await expect(f.run('import { doppio } from "utilita.mine"; print(base(3));')).rejects.toThrow(
      'funzione "base" sconosciuta.',
    );
  });

  it('rejects invalid imports before running the main file', async () => {
    const f = fixture();
    f.host.entryFileName = 'main.mine';
    f.host.modules = {
      'side.mine': 'print("unexpected"); def utile() { return 1; }',
      'cycle.mine': 'import "main.mine";',
    };

    for (const source of [
      'print("early"); import "missing.mine";',
      'print("early"); import "side.mine";',
      'print("early"); import "cycle.mine";',
      'print("early"); import "toString";',
    ]) {
      await expect(f.run(source)).rejects.toThrow();
      expect(f.output).toEqual([]);
    }
  });

  it('uses the live progress in while and supports if/else', async () => {
    const f = fixture();
    await f.run(
      'while (progress() < 100) { mine(); } if (progress() == 100) { print("ok"); } else { print("no"); }',
    );
    expect(f.output).toEqual(['ok']);
    expect(f.mine).toHaveBeenCalledTimes(5);
  });

  it('supports nested loops, comments and escaped strings', async () => {
    const f = fixture();
    await f.run('// mine();\nrepeat(2) { repeat(2) { mine(); } } print("a\\\"b");');
    expect(f.mine).toHaveBeenCalledTimes(4);
    expect(f.output).toEqual(['a"b']);
  });

  it('short-circuits logical conditions', async () => {
    const f = fixture();
    await f.run('if (false && mine()) { print("no"); } if (true || mine()) { print("yes"); }');
    expect(f.mine).not.toHaveBeenCalled();
    expect(f.output).toEqual(['yes']);
  });

  it.each([
    'repeat(-1) {}',
    'repeat(1.5) {}',
    'repeat(1001) {}',
    'wait(-1);',
    'wait(5001);',
    'mine(0);',
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
    await expect(f.run('mine();\nrepeat (5) {\n mine()\n}')).rejects.toThrow('Riga 4:');
    expect(f.mine).not.toHaveBeenCalled();
  });

  it('rejects browser APIs and excessive nesting', async () => {
    await expect(fixture().run('window.alert("hello");')).rejects.toThrow('window');
    expect(() => parse('repeat(1){'.repeat(80) + '}'.repeat(80))).toThrow('annidamento');
  });

  it('stops an infinite loop at the instruction budget', async () => {
    vi.useFakeTimers();
    try {
      const running = fixture().run('while(true) {}');
      const result = expect(running).rejects.toThrow(
        `${GAME_BALANCE.scripting.maxExecutionSteps.toLocaleString('it-IT')} operazioni`,
      );
      await vi.runAllTimersAsync();
      await result;
    } finally {
      vi.useRealTimers();
    }
  }, 20_000);

  it('allows cancellation while waiting without executing subsequent calls', async () => {
    const f = fixture();
    const running = f.run('wait(5000); mine();');
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

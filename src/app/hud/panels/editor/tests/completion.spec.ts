import { describe, expect, it } from 'vitest';
import { getCompletions } from '../completion';

const labels = (source: string) =>
  getCompletions(source, source.length)?.items.map((item) => item.label) ?? [];

describe('MineScript completions', () => {
  it('suggests GPU members through a variable, index and vector slice', () => {
    const code = 'let gpus = plots[0].rigs[0].gpus;\n';
    expect(labels(code + 'gpus[0].')).toContain('getTemperatureCelsius');
    expect(labels(code + 'gpus.slice(0, 1)[0].')).toContain('setFrequencyGhz');
    expect(labels(code + 'gpus[0].getT')).toContain('getTemperatureCelsius');
    expect(labels(code + 'gpus[0].getT')).not.toContain('setFrequencyGhz');
    expect(getCompletions(code + 'gpus[0].getT', (code + 'gpus[0].getT').length)?.start).toBe(
      code.length + 'gpus[0].'.length,
    );
    expect(labels(code + 'let gpu = gpus[0];\ngpu.')).toContain('estimate');
  });

  it('follows plot, rig and estimate types', () => {
    expect(labels('plots[0].')).toContain('rigs');
    expect(labels('plots[0].rigs[0].')).toContain('gpus');
    expect(labels('plots[0].rigs[0].gpus[0].estimate().')).toContain('profitPerActionEur');
    expect(labels('electricity.')).toContain('getPricePerKwh');
  });

  it('ignores comments and strings', () => {
    expect(labels('// gpus[0].')).toEqual([]);
    expect(labels('/* plots[0]. */')).toEqual([]);
    expect(labels('print("gpu.')).toEqual([]);
    expect(labels('/* plots[0]. */\nplots[0].')).toContain('rigs');
  });
});

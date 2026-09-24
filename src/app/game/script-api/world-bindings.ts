import { VectorValue } from '../../language/collections/vector';
import type { Value } from '../../language/syntax';
import type { MiningWorld } from '../mining-world';
import { PlotScriptObject } from './plot-script-object';

export function createWorldBindings(
  world: MiningWorld,
  isSelected: (gpuId: number) => boolean,
  getWorkload: () => number,
  mineGpu: (gpuId: number) => Promise<void>,
): Readonly<Record<string, Value>> {
  const plots = new VectorValue(
    world.plots.map((plot) => new PlotScriptObject(plot, isSelected, getWorkload, mineGpu)),
    true,
  );
  return { plots };
}

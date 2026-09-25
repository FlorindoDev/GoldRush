import { VectorValue } from '../../language/collections/vector';
import type { Value } from '../../language/syntax';
import type { MiningWorld } from '../mining-world';
import { PlotScriptObject } from './plot-script-object';
import type { GpuScriptControls } from './gpu-script-object';
import { ElectricityScriptObject, type ElectricityReadings } from './electricity-script-object';

export function createWorldBindings(
  world: MiningWorld,
  controls: GpuScriptControls,
  readElectricity: () => ElectricityReadings,
): Readonly<Record<string, Value>> {
  const plots = new VectorValue(
    world.plots.map((plot) => new PlotScriptObject(plot, controls)),
    true,
  );
  return { plots, electricity: new ElectricityScriptObject(readElectricity) };
}

import { ScriptError, type ScriptObject, type Value } from '../../language/syntax';
import { VectorValue } from '../../language/collections/vector';
import { countUnlockedGpusInRig, type MiningPlot } from '../mining-world';
import { RigScriptObject } from './rig-script-object';
import type { GpuScriptControls } from './gpu-script-object';
import { requireArguments, requireIndex } from './script-api-utils';

export class PlotScriptObject implements ScriptObject {
  readonly objectType = 'plot';
  readonly rigs: VectorValue;

  constructor(
    private readonly plot: MiningPlot,
    controls: GpuScriptControls,
  ) {
    this.rigs = new VectorValue(
      plot.rigs.map((rig) => new RigScriptObject(rig, controls)),
      true,
    );
  }

  getAttribute(name: string, line: number): Value {
    switch (name) {
      case 'id':
        return this.plot.id;
      case 'rigs':
        return this.rigs;
      case 'rigCount':
        return this.plot.rigs.length;
      case 'gpuCount':
        return this.plot.rigs.reduce((count, rig) => count + countUnlockedGpusInRig(rig), 0);
      case 'gpuCapacity':
        return this.plot.rigs.reduce((count, rig) => count + rig.gpus.length, 0);
      default:
        throw new ScriptError(`attributo "${name}" non disponibile per un plot.`, line);
    }
  }

  callMethod(name: string, args: Value[], line: number): Value {
    if (name !== 'rig') {
      throw new ScriptError(`metodo "${name}" non disponibile per un plot.`, line);
    }
    requireArguments(name, args, 1, line);
    return this.rigs.getItem(requireIndex(args[0], line), line);
  }

  toDisplayString(): string {
    return `Plot(${this.plot.id})`;
  }
}

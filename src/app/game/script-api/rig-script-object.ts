import { ScriptError, type ScriptObject, type Value } from '../../language/syntax';
import { VectorValue } from '../../language/collections/vector';
import { countUnlockedGpusInRig, type MiningRig } from '../mining-world';
import { GpuScriptObject, type GpuScriptControls } from './gpu-script-object';

export class RigScriptObject implements ScriptObject {
  readonly objectType = 'rig';
  readonly gpus: VectorValue;

  constructor(
    private readonly rig: MiningRig,
    controls: GpuScriptControls,
  ) {
    this.gpus = new VectorValue(
      rig.gpus.map((gpu) => new GpuScriptObject(gpu.id, rig.unlocked, controls)),
      true,
    );
  }

  getAttribute(name: string, line: number): Value {
    switch (name) {
      case 'id':
        return this.rig.id;
      case 'plotId':
        return this.rig.plotId;
      case 'unlocked':
        return this.rig.unlocked;
      case 'gpus':
        return this.gpus;
      case 'gpuCount':
        return countUnlockedGpusInRig(this.rig);
      case 'gpuCapacity':
        return this.rig.gpus.length;
      default:
        throw new ScriptError(`attributo "${name}" non disponibile per un rig.`, line);
    }
  }

  callMethod(name: string, _args: Value[], line: number): Value {
    throw new ScriptError(`metodo "${name}" non disponibile per un rig.`, line);
  }

  toDisplayString(): string {
    return `Rig(${this.rig.id})`;
  }
}

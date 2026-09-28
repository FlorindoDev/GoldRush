import { ScriptError, type ScriptObject, type Value } from '../../language/syntax';
import { VectorValue } from '../../language/collections/vector';
import { countUnlockedGpusInRig, type MiningRig } from '../mining-world';
import { GpuScriptObject, type GpuScriptControls } from './gpu-script-object';

export class RigScriptObject implements ScriptObject {
  readonly objectType = 'rig';
  private readonly rigId: number;

  constructor(
    rig: MiningRig,
    private readonly controls: GpuScriptControls,
  ) {
    this.rigId = rig.id;
  }

  get gpus(): VectorValue {
    return new VectorValue(
      this.controls
        .getRig(this.rigId)
        .gpus.map((gpu) => new GpuScriptObject(gpu.id, this.controls)),
      true,
    );
  }

  getAttribute(name: string, line: number): Value {
    const rig = this.controls.getRig(this.rigId);
    switch (name) {
      case 'id':
        return rig.id;
      case 'plotId':
        return rig.plotId;
      case 'unlocked':
        return rig.unlocked;
      case 'gpus':
        return this.gpus;
      case 'gpuCount':
        return countUnlockedGpusInRig(rig);
      case 'gpuCapacity':
        return rig.gpus.length;
      default:
        throw new ScriptError(`attributo "${name}" non disponibile per un rig.`, line);
    }
  }

  callMethod(name: string, _args: Value[], line: number): Value {
    throw new ScriptError(`metodo "${name}" non disponibile per un rig.`, line);
  }

  toDisplayString(): string {
    return `Rig(${this.rigId})`;
  }
}

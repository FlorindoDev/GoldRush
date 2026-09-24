import { ScriptError, type ScriptObject, type Value } from '../../language/syntax';
import { VectorValue } from '../../language/collections/vector';
import { countUnlockedGpusInRig, type MiningRig } from '../mining-world';
import { GpuScriptObject } from './gpu-script-object';
import { requireArguments, requireIndex } from './script-api-utils';

export class RigScriptObject implements ScriptObject {
  readonly objectType = 'rig';
  readonly gpus: VectorValue;

  constructor(
    private readonly rig: MiningRig,
    isSelected: (gpuId: number) => boolean,
    getWorkload: () => number,
    mineGpu: (gpuId: number) => Promise<void>,
  ) {
    this.gpus = new VectorValue(
      rig.gpus.map(
        (gpu) => new GpuScriptObject(gpu, rig.unlocked, isSelected, getWorkload, mineGpu),
      ),
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

  callMethod(name: string, args: Value[], line: number): Value {
    if (name !== 'gpu') {
      throw new ScriptError(`metodo "${name}" non disponibile per un rig.`, line);
    }
    requireArguments(name, args, 1, line);
    return this.gpus.getItem(requireIndex(args[0], line), line);
  }

  toDisplayString(): string {
    return `Rig(${this.rig.id})`;
  }
}

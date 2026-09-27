import { ScriptError, type ScriptObject, type Value } from '../../language/syntax';
import type { MiningEstimate } from '../mining-estimate';

export class MiningEstimateScriptObject implements ScriptObject {
  readonly objectType = 'MiningEstimate';

  constructor(private readonly estimate: MiningEstimate) {}

  getAttribute(name: string, line: number): Value {
    if (Object.hasOwn(this.estimate, name)) return this.estimate[name as keyof MiningEstimate];
    throw new ScriptError(`attributo "${name}" non disponibile per una stima di mining.`, line);
  }

  callMethod(name: string, _args: Value[], line: number): Value {
    throw new ScriptError(`metodo "${name}" non disponibile per una stima di mining.`, line);
  }

  toDisplayString(): string {
    return `MiningEstimate(${this.estimate.crypto})`;
  }
}

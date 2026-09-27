import { ScriptError, type ScriptObject, type Value } from '../syntax';
import { MAX_COLLECTION_SIZE, requireMethodArguments } from './collection-utils';
import { requireVector, VectorValue } from './vector';

export class VectorStackValue implements ScriptObject {
  readonly objectType = 'pila di vettori';
  private readonly items: VectorValue[] = [];

  getAttribute(name: string, line: number): Value {
    if (name === 'size' || name === 'length') {
      return this.items.length;
    }
    throw new ScriptError(`attributo "${name}" non disponibile per una pila.`, line);
  }

  callMethod(name: string, args: Value[], line: number): Value {
    switch (name) {
      case 'size':
      case 'length':
        requireMethodArguments(name, args, 0, line);
        return this.items.length;
      case 'push':
        requireMethodArguments(name, args, 1, line);
        if (this.items.length >= MAX_COLLECTION_SIZE) {
          throw new ScriptError(
            `una pila può contenere al massimo ${MAX_COLLECTION_SIZE} vettori.`,
            line,
          );
        }
        this.items.push(requireVector(args[0], line));
        return this.items.length;
      case 'pop':
        requireMethodArguments(name, args, 0, line);
        return this.items.pop() ?? null;
      case 'peek':
        requireMethodArguments(name, args, 0, line);
        return this.items.at(-1) ?? null;
      case 'isEmpty':
        requireMethodArguments(name, args, 0, line);
        return this.items.length === 0;
      case 'clear':
        requireMethodArguments(name, args, 0, line);
        this.items.length = 0;
        return null;
      default:
        throw new ScriptError(`metodo "${name}" non disponibile per una pila di vettori.`, line);
    }
  }

  toDisplayString(): string {
    return `Pila<Vettore>(${this.items.length})`;
  }
}

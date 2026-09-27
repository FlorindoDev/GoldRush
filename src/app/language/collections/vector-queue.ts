import { ScriptError, type ScriptObject, type Value } from '../syntax';
import { MAX_COLLECTION_SIZE, requireMethodArguments } from './collection-utils';
import { requireVector, VectorValue } from './vector';

export class VectorQueueValue implements ScriptObject {
  readonly objectType = 'coda di vettori';
  private items: VectorValue[] = [];
  private head = 0;

  getAttribute(name: string, line: number): Value {
    if (name === 'size' || name === 'length') {
      return this.items.length - this.head;
    }
    throw new ScriptError(`attributo "${name}" non disponibile per una coda.`, line);
  }

  callMethod(name: string, args: Value[], line: number): Value {
    switch (name) {
      case 'size':
      case 'length':
        requireMethodArguments(name, args, 0, line);
        return this.items.length - this.head;
      case 'enqueue':
        requireMethodArguments(name, args, 1, line);
        if (this.items.length - this.head >= MAX_COLLECTION_SIZE) {
          throw new ScriptError(
            `una coda può contenere al massimo ${MAX_COLLECTION_SIZE} vettori.`,
            line,
          );
        }
        this.items.push(requireVector(args[0], line));
        return this.items.length - this.head;
      case 'dequeue':
        requireMethodArguments(name, args, 0, line);
        return this.takeFirst() ?? null;
      case 'peek':
      case 'front':
        requireMethodArguments(name, args, 0, line);
        return this.items[this.head] ?? null;
      case 'back':
        requireMethodArguments(name, args, 0, line);
        return this.head === this.items.length ? null : (this.items.at(-1) ?? null);
      case 'isEmpty':
        requireMethodArguments(name, args, 0, line);
        return this.head === this.items.length;
      case 'clear':
        requireMethodArguments(name, args, 0, line);
        this.items = [];
        this.head = 0;
        return null;
      default:
        throw new ScriptError(`metodo "${name}" non disponibile per una coda di vettori.`, line);
    }
  }

  toDisplayString(): string {
    return `Coda<Vettore>(${this.items.length - this.head})`;
  }

  private takeFirst(): VectorValue | undefined {
    if (this.head === this.items.length) {
      return undefined;
    }

    const item = this.items[this.head++];
    if (this.head >= 64 && this.head * 2 >= this.items.length) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return item;
  }
}

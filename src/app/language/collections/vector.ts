import { ScriptError, type ScriptIndexable, type Value } from '../syntax';
import { MAX_COLLECTION_SIZE, requireIndex, requireMethodArguments } from './collection-utils';

export class VectorValue implements ScriptIndexable {
  readonly objectType = 'vettore';
  private readonly items: Value[];

  constructor(
    items: readonly Value[] = [],
    private readonly readOnly = false,
  ) {
    this.items = [...items];
  }

  getAttribute(name: string, line: number): Value {
    switch (name) {
      case 'length':
      case 'size':
        return this.items.length;
      case 'first':
        return this.items[0] ?? null;
      case 'last':
        return this.items.at(-1) ?? null;
      default:
        throw new ScriptError(`attributo "${name}" non disponibile per un vettore.`, line);
    }
  }

  getItem(index: number, line: number): Value {
    return this.items[requireIndex(index, this.items.length, false, line)];
  }

  callMethod(name: string, args: Value[], line: number): Value {
    switch (name) {
      case 'size':
      case 'length':
        requireMethodArguments(name, args, 0, line);
        return this.items.length;
      case 'push':
        requireMethodArguments(name, args, 1, line);
        this.ensureMutable(line);
        this.ensureCapacity(line);
        this.items.push(args[0]);
        return this.items.length;
      case 'pop':
        requireMethodArguments(name, args, 0, line);
        this.ensureMutable(line);
        return this.items.pop() ?? null;
      case 'set': {
        requireMethodArguments(name, args, 2, line);
        this.ensureMutable(line);
        const index = this.requireIndexArgument(args[0], line);
        this.items[requireIndex(index, this.items.length, false, line)] = args[1];
        return args[1];
      }
      case 'insert': {
        requireMethodArguments(name, args, 2, line);
        this.ensureMutable(line);
        this.ensureCapacity(line);
        const index = requireIndex(args[0], this.items.length, true, line);
        this.items.splice(index, 0, args[1]);
        return this.items.length;
      }
      case 'remove': {
        requireMethodArguments(name, args, 1, line);
        this.ensureMutable(line);
        const index = this.requireIndexArgument(args[0], line);
        return this.items.splice(requireIndex(index, this.items.length, false, line), 1)[0];
      }
      case 'contains':
        requireMethodArguments(name, args, 1, line);
        return this.items.includes(args[0]);
      case 'indexOf':
        requireMethodArguments(name, args, 1, line);
        return this.items.indexOf(args[0]);
      case 'concat': {
        requireMethodArguments(name, args, 1, line);
        const other = requireVector(args[0], line);
        if (this.items.length + other.items.length > MAX_COLLECTION_SIZE) {
          throw new ScriptError(
            `un vettore può contenere al massimo ${MAX_COLLECTION_SIZE} elementi.`,
            line,
          );
        }
        return new VectorValue([...this.items, ...other.items]);
      }
      case 'slice': {
        requireMethodArguments(name, args, 2, line);
        const start = requireIndex(args[0], this.items.length, true, line);
        const end = requireIndex(args[1], this.items.length, true, line);
        if (end < start) {
          throw new ScriptError('il limite finale di slice deve seguire quello iniziale.', line);
        }
        return new VectorValue(this.items.slice(start, end));
      }
      case 'copy':
        requireMethodArguments(name, args, 0, line);
        return new VectorValue(this.items);
      case 'reverse':
        requireMethodArguments(name, args, 0, line);
        this.ensureMutable(line);
        this.items.reverse();
        return this;
      case 'sort':
        requireMethodArguments(name, args, 0, line);
        this.ensureMutable(line);
        this.sortItems(line);
        return this;
      case 'clear':
        requireMethodArguments(name, args, 0, line);
        this.ensureMutable(line);
        this.items.length = 0;
        return null;
      case 'isEmpty':
        requireMethodArguments(name, args, 0, line);
        return this.items.length === 0;
      default:
        throw new ScriptError(`metodo "${name}" non disponibile per un vettore.`, line);
    }
  }

  toDisplayString(): string {
    return `Vettore(${this.items.length})`;
  }

  private requireIndexArgument(value: Value, line: number): number {
    if (typeof value !== 'number') {
      throw new ScriptError('l’indice deve essere un numero intero.', line);
    }
    return value;
  }

  private ensureMutable(line: number): void {
    if (this.readOnly) {
      throw new ScriptError('questo vettore è di sola lettura.', line);
    }
  }

  private ensureCapacity(line: number): void {
    if (this.items.length >= MAX_COLLECTION_SIZE) {
      throw new ScriptError(
        `un vettore può contenere al massimo ${MAX_COLLECTION_SIZE} elementi.`,
        line,
      );
    }
  }

  private sortItems(line: number): void {
    const type = typeof this.items[0];
    if (
      (type !== 'number' && type !== 'string') ||
      this.items.some((item) => typeof item !== type)
    ) {
      if (this.items.length === 0) {
        return;
      }
      throw new ScriptError('sort richiede solo numeri o solo stringhe.', line);
    }

    this.items.sort((left, right) => {
      if (typeof left === 'number' && typeof right === 'number') {
        return left - right;
      }
      if (typeof left === 'string' && typeof right === 'string') {
        return left < right ? -1 : left > right ? 1 : 0;
      }
      return 0;
    });
  }
}

export function requireVector(value: Value, line: number): VectorValue {
  if (!(value instanceof VectorValue)) {
    throw new ScriptError('atteso un vettore.', line);
  }
  return value;
}

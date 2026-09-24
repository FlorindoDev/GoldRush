import { ScriptError, type Value } from '../../language/syntax';

export function requireArguments(
  method: string,
  args: readonly Value[],
  count: number,
  line: number,
): void {
  if (args.length !== count) {
    throw new ScriptError(`${method} richiede ${count} argomenti.`, line);
  }
}

export function requireIndex(value: Value, line: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ScriptError('l’indice deve essere un intero non negativo.', line);
  }
  return value;
}

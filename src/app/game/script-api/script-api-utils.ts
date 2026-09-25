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

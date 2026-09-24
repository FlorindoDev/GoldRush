import { GAME_BALANCE } from '../../config/game-balance';
import { ScriptError, type Value } from '../syntax';

export const MAX_COLLECTION_SIZE = GAME_BALANCE.scripting.maxCollectionSize;

export function requireMethodArguments(
  method: string,
  args: readonly Value[],
  expected: number,
  line: number,
): void {
  if (args.length !== expected) {
    throw new ScriptError(`${method} richiede ${expected} argomenti.`, line);
  }
}

export function requireIndex(
  value: Value,
  maximum: number,
  allowEnd: boolean,
  line: number,
): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ScriptError('l’indice deve essere un numero intero.', line);
  }
  if (value < 0 || value > maximum || (!allowEnd && value === maximum)) {
    throw new ScriptError(`indice fuori intervallo (0–${maximum}).`, line);
  }
  return value;
}

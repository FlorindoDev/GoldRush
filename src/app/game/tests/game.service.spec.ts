import { describe, expect, it } from 'vitest';
import { GameService } from '../game.service';

async function waitForPause(game: GameService): Promise<void> {
  for (let attempt = 0; attempt < 100 && !game.waitingForStep(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(game.waitingForStep()).toBe(true);
}

function output(game: GameService): string[] {
  return game
    .logs()
    .filter((entry) => entry.kind === 'output')
    .map((entry) => entry.message);
}

function createGame(code: string): GameService {
  const game = new GameService();
  game.start();
  game.updateCode(code);
  return game;
}

describe('GameService script controls', () => {
  it('executes one statement at a time and pauses before the next', async () => {
    const game = createGame('print("first");\nprint("second");');
    const execution = game.step();

    await waitForPause(game);
    expect(output(game)).toEqual(['first']);
    expect(game.activeLine()).toBe(1);

    await game.step();
    await execution;
    expect(output(game)).toEqual(['first', 'second']);
  });

  it('continues all remaining statements when run is pressed during stepping', async () => {
    const game = createGame('print("first");\nprint("second");\nprint("third");');
    const execution = game.step();

    await waitForPause(game);
    await game.run();
    await execution;

    expect(output(game)).toEqual(['first', 'second', 'third']);
    expect(game.running()).toBe(false);
  });

  it('stops cleanly while waiting for the next step', async () => {
    const game = createGame('print("first");\nprint("must not run");');
    const execution = game.step();

    await waitForPause(game);
    game.stop();
    await execution;

    expect(output(game)).toEqual(['first']);
    expect(game.running()).toBe(false);
    expect(game.waitingForStep()).toBe(false);
  });

  it('runs a function imported from a second file', async () => {
    const game = createGame('import "utilita.mine"; print(doppio(3));');
    const entryId = game.activeFileId();
    const library = game.createFile('utilita.mine');
    game.updateFileCode(library.id, 'def doppio(numero) { return numero * 2; }');

    await game.runFile(entryId);

    expect(output(game)).toEqual(['6']);
    expect(game.running()).toBe(false);
  });

  it('keeps one file running when another file requests execution', async () => {
    const game = createGame('print("first");\nprint("second");');
    const entryId = game.activeFileId();
    const other = game.createFile('other.mine');
    game.updateFileCode(other.id, 'print("other");');

    const execution = game.stepFile(entryId);
    await waitForPause(game);
    await game.runFile(other.id);

    expect(game.executingFileId()).toBe(entryId);
    expect(game.activeFileId()).toBe(entryId);
    expect(output(game)).toEqual(['first']);

    await game.runFile(entryId);
    await execution;
    expect(output(game)).toEqual(['first', 'second']);
  });
});

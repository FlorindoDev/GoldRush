import { describe, expect, it, vi } from 'vitest';
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
  it('keeps game time frozen through a pause, even between clock ticks', () => {
    let now = 1000;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    try {
      const game = createGame('');
      now = 1100;
      game.setPaused(true);
      now = 1500;
      expect(game.activeTimeNow()).toBe(1100);
      game.advanceGameTime(400);
      expect(game.gameElapsedMinutes()).toBe(0);

      game.setPaused(false);
      now = 1600;
      expect(game.activeTimeNow()).toBe(1200);
    } finally {
      clock.mockRestore();
    }
  });

  it('does not finish a wait while the game is paused', async () => {
    const game = createGame('wait(40); print("done");');
    const execution = game.run();
    await new Promise((resolve) => setTimeout(resolve, 10));
    game.setPaused(true);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(output(game)).toEqual([]);

    game.setPaused(false);
    await execution;
    expect(output(game)).toEqual(['done']);
  });

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

  it('does not start a second file during continuous execution', async () => {
    const game = createGame('wait(50); print("main");');
    const entryId = game.activeFileId();
    const other = game.createFile('other.mine');
    game.updateFileCode(other.id, 'print("other");');

    const execution = game.runFile(entryId);
    await game.runFile(other.id);

    expect(game.executingFileId()).toBe(entryId);
    expect(game.activeFileId()).toBe(entryId);
    await execution;
    expect(output(game)).toEqual(['main']);
  });
});

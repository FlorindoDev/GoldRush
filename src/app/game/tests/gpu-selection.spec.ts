import { describe, expect, it } from 'vitest';
import { GameService } from '../game.service';

function createGame(): GameService {
  const game = new GameService();
  game.world.update((world) => ({
    ...world,
    plots: world.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((rig) => ({
        ...rig,
        unlocked: rig.id === 1,
        gpus: rig.gpus.map((gpu) => ({ ...gpu, unlocked: gpu.id <= 2 })),
      })),
    })),
  }));
  return game;
}

describe('GPU selection and workbench', () => {
  it('selects a GPU without transferring it and keeps an existing bench GPU in place', () => {
    const game = createGame();
    game.select(1);
    expect(game.selectedGpuId()).toBe(1);
    expect(game.inspectedGpuId()).toBeNull();
    game.inspectGpu(1);
    game.select(2);
    expect(game.selectedGpuId()).toBe(2);
    expect(game.inspectedGpuId()).toBe(1);
    game.inspectGpu(2);
    expect(game.inspectedGpuId()).toBe(2);
  });

  it('keeps both selections on return and clears them on plot change or reset', () => {
    const game = createGame();
    game.inspectGpu(1);
    game.returnToRig();
    expect(game.selectedGpuId()).toBe(1);
    expect(game.inspectedGpuId()).toBeNull();
    game.viewRig(1);
    expect(game.selectedGpuId()).toBe(1);
    expect(game.selectedRigId()).toBe(1);
    game.inspectGpu(2);
    game.viewPlot(2);
    expect(game.selectedGpuId()).toBeNull();
    expect(game.inspectedGpuId()).toBeNull();
    game.inspectGpu(1);
    game.reset();
    expect(game.selectedGpuId()).toBeNull();
    expect(game.inspectedGpuId()).toBeNull();
  });

  it('keeps a selected GPU and RIG together for the HUD', () => {
    const game = createGame();
    game.select(1);
    game.viewRig(1);
    expect(game.selectedGpuId()).toBe(1);
    expect(game.selectedRigId()).toBe(1);
  });

  it('keeps one GPU and one RIG on their benches at the same time', () => {
    const game = createGame();
    game.inspectGpu(1);
    game.inspectRig(1);
    expect(game.inspectedGpuId()).toBe(1);
    expect(game.inspectedRigId()).toBe(1);
    expect(game.world().plots[0]!.rigs[0]!.gpus[0]!.onWorkbench).toBe(true);

    game.closeInspectedRigWorkbench();
    expect(game.inspectedGpuId()).toBe(1);
    expect(game.inspectedRigId()).toBeNull();
    game.inspectRig(1);
    game.returnInspectedGpuToRig();
    expect(game.inspectedGpuId()).toBeNull();
    expect(game.inspectedRigId()).toBe(1);
    expect(game.world().plots[0]!.rigs[0]!.gpus[0]!.onWorkbench).toBe(false);
  });

  it('ignores locked GPUs and both gestures while a script is running', () => {
    const game = createGame();
    game.select(3);
    game.inspectGpu(3);
    expect(game.selectedGpuId()).toBeNull();
    expect(game.inspectedGpuId()).toBeNull();
    game.select(1);
    game.running.set(true);
    game.select(2);
    game.inspectGpu(2);
    expect(game.selectedGpuId()).toBe(1);
    expect(game.inspectedGpuId()).toBeNull();
  });

  it('exposes the actual selection through MineScript even with another GPU on the bench', async () => {
    const game = createGame();
    game.start();
    game.setLineEffectsEnabled(false);
    game.inspectGpu(1);
    game.select(2);
    game.updateCode(
      'print(plots[0].rigs[0].gpus[0].isSelected()); print(plots[0].rigs[0].gpus[1].selected);',
    );
    await game.run();
    expect(
      game
        .logs()
        .filter((log) => log.kind === 'output')
        .map((log) => log.message),
    ).toEqual(['false', 'true']);
  });
});

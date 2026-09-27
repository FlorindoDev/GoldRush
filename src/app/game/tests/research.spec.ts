import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { RESEARCH_TREE, flattenResearchTree } from '../../config/research-tree-config';
import { GameService } from '../game.service';
import { createWorld } from '../mining-world';
import {
  canUnlockResearch,
  isResearchUnlocked,
  researchPriceAvailable,
  unlockResearch,
} from '../research';

describe('Albero della ricerca', () => {
  it('has unique IDs, valid references and a GLB for every node', () => {
    const nodes = flattenResearchTree();
    const ids = new Set(nodes.map((node) => node.id));
    expect(ids.size).toBe(nodes.length);
    for (const node of nodes) {
      expect(existsSync(`public/${node.model}`)).toBe(true);
      for (const requirement of node.requirements ?? []) {
        if (requirement.kind === 'node') expect(ids.has(requirement.id)).toBe(true);
      }
    }
  });

  it('charges holdings once and keeps the world unchanged on failure', () => {
    const initial = { ...createWorld(), holdings: { bitcoin: 0.01 } };
    const filter = RESEARCH_TREE.children![3].children![0];
    expect(canUnlockResearch(initial, filter)).toBe(true);
    const unlocked = unlockResearch(initial, filter.id);
    expect(isResearchUnlocked(unlocked, filter.id)).toBe(true);
    expect(researchPriceAvailable(unlocked)).toBeCloseTo(600 - filter.costEur);
    expect(initial.holdings.bitcoin).toBe(0.01);
    expect(() => unlockResearch(unlocked, filter.id)).toThrow('già sbloccata');
    expect(() => unlockResearch(createWorld(), filter.id)).toThrow('Saldo insufficiente');
  });

  it('requires its parent and extra milestones before purchase', () => {
    const initial = { ...createWorld(), holdings: { bitcoin: 1 } };
    expect(isResearchUnlocked(initial, 'gpu-passive')).toBe(true);
    expect(isResearchUnlocked(initial, 'gpu-compact')).toBe(false);
    expect(() => unlockResearch(initial, 'gpu-triple')).toThrow('Requisiti');
    const compact = unlockResearch(initial, 'gpu-compact');
    const dual = unlockResearch(compact, 'gpu-dual');
    expect(() => unlockResearch(dual, 'gpu-triple')).toThrow('Requisiti');
    const chain = dual.cryptoChains.bitcoin;
    const progressed = {
      ...dual,
      cryptoChains: { ...dual.cryptoChains, bitcoin: { ...chain, settledBlockIds: [1, 2] } },
    };
    expect(isResearchUnlocked(unlockResearch(progressed, 'gpu-triple'), 'gpu-triple')).toBe(true);
  });

  it('gates equipment and crypto through GameService', () => {
    const game = new GameService();
    game.world.set({ ...createWorld(), holdings: { bitcoin: 1 } });
    game.inspectRig(1);
    expect(() => game.configureInspectedRig({ fanId: 'fan-pressure-140' })).toThrow('Sblocca');
    expect(() => game.setGpusCrypto([1], 'RVN')).toThrow('Sblocca');
    game.unlockResearch('fan-pressure-140');
    game.world.update((world) => ({
      ...world,
      cryptoChains: {
        ...world.cryptoChains,
        dogecoin: { ...world.cryptoChains.dogecoin, settledBlockIds: [1, 2, 3, 4] },
      },
    }));
    game.unlockResearch('ravencoin');
    game.buyCart([{ productId: 'fan-pressure-140', quantity: 5 }]);
    game.configureInspectedRig({ fanId: 'fan-pressure-140' });
    game.setGpusCrypto([1], 'RVN');
    expect(game.world().plots[0].rigs[0].setup.fanId).toBe('fan-pressure-140');
    expect(game.world().plots[0].rigs[0].gpus[0].cryptoId).toBe('ravencoin');
  });
});

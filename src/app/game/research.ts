import { cryptoValueEur } from '../config/crypto-config';
import {
  RESEARCH_TREE,
  type ResearchNode,
  type ResearchRequirement,
  flattenResearchTree,
} from '../config/research-tree-config';
import { countUnlockedRigs, type MiningWorld } from './mining-world';
import { spendEuros } from './wallet-transactions';

const nodes = flattenResearchTree();
const byId = new Map(nodes.map((node) => [node.id, node]));
const parents = new Map<string, string>();

function indexParents(node: ResearchNode): void {
  for (const child of node.children ?? []) {
    parents.set(child.id, node.id);
    indexParents(child);
  }
}
indexParents(RESEARCH_TREE);

export function researchNode(id: string): ResearchNode | undefined {
  return byId.get(id);
}

export function isResearchUnlocked(world: MiningWorld, id: string): boolean {
  const node = byId.get(id);
  return !!node && (!!node.initiallyUnlocked || world.unlockedResearchIds.includes(id));
}

export function researchRequirements(node: ResearchNode): readonly ResearchRequirement[] {
  const parentId = parents.get(node.id);
  return [
    ...(parentId ? [{ kind: 'node' as const, id: parentId }] : []),
    ...(node.requirements ?? []),
  ];
}

export function requirementMet(world: MiningWorld, requirement: ResearchRequirement): boolean {
  switch (requirement.kind) {
    case 'node':
      return isResearchUnlocked(world, requirement.id);
    case 'blocks':
      return (
        Object.values(world.cryptoChains).reduce(
          (total, chain) => total + chain.settledBlockIds.length,
          0,
        ) >= requirement.count
      );
    case 'rigs':
      return countUnlockedRigs(world) >= requirement.count;
  }
}

export function researchPriceAvailable(world: MiningWorld): number {
  return world.cashEur + cryptoValueEur(world.holdings);
}

export function canUnlockResearch(world: MiningWorld, node: ResearchNode): boolean {
  return (
    Number.isFinite(node.costEur) &&
    node.costEur >= 0 &&
    !isResearchUnlocked(world, node.id) &&
    researchRequirements(node).every((requirement) => requirementMet(world, requirement)) &&
    researchPriceAvailable(world) + 0.000001 >= node.costEur
  );
}

/** Acquisto atomico: prima valida tutto, poi scala euro e cripto ai prezzi fissi di gioco. */
export function unlockResearch(world: MiningWorld, id: string): MiningWorld {
  const node = byId.get(id);
  if (!node || isResearchUnlocked(world, id)) {
    throw new Error('Ricerca inesistente o già sbloccata.');
  }
  if (!Number.isFinite(node.costEur) || node.costEur < 0) {
    throw new Error('Costo della ricerca non valido.');
  }
  if (!researchRequirements(node).every((requirement) => requirementMet(world, requirement))) {
    throw new Error('Requisiti della ricerca non soddisfatti.');
  }
  if (researchPriceAvailable(world) + 0.000001 < node.costEur) {
    throw new Error('Saldo insufficiente per sbloccare la ricerca.');
  }

  return {
    ...spendEuros(world, node.costEur),
    unlockedResearchIds: [...world.unlockedResearchIds, id],
  };
}

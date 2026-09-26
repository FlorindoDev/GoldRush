import { CRYPTO_CONFIG } from '../config/crypto-config';
import {
  RESEARCH_TREE,
  type ResearchNode,
  type ResearchRequirement,
  flattenResearchTree,
} from '../config/research-tree-config';
import { countUnlockedRigs, type MiningWorld } from './mining-world';

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
  return (
    world.cashEur +
    CRYPTO_CONFIG.reduce(
      (total, crypto) => total + (world.holdings[crypto.id] ?? 0) * crypto.priceEur,
      0,
    )
  );
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

  let remaining = node.costEur;
  const cashSpent = Math.min(Math.max(world.cashEur, 0), remaining);
  remaining -= cashSpent;
  const holdings = { ...world.holdings };
  for (const crypto of CRYPTO_CONFIG) {
    if (remaining <= 0.000001) break;
    const amount = holdings[crypto.id] ?? 0;
    const spent = Math.min(amount * crypto.priceEur, remaining);
    holdings[crypto.id] = Math.max(0, amount - spent / crypto.priceEur);
    remaining -= spent;
  }
  return {
    ...world,
    cashEur: world.cashEur - cashSpent,
    holdings,
    unlockedResearchIds: [...world.unlockedResearchIds, id],
  };
}

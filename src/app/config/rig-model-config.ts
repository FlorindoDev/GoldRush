import { PURCHASED_RIG_SETUP, type RigSetup } from './rig-config';

export interface RigModel {
  readonly id: string;
  readonly name: string;
  readonly slots: 4 | 8;
  readonly filter: 'none' | 'mesh';
  readonly cooling: 'none' | 'air' | 'liquid' | 'bracket';
  readonly priceEur: number;
  readonly researchCostEur: number;
  readonly parentId: string;
  readonly requiredNodeIds: readonly string[];
  readonly description: string;
}

export const RIG_MODELS: readonly RigModel[] = ([4, 8] as const)
  .flatMap((slots) => {
    const baseId = slots === 4 ? 'rig-gameplay' : 'rig-8-frame-none';
    const basePrice = slots === 4 ? 95 : 210;
    const variants = [
      { suffix: 'none', label: 'Telaio base', filter: 'none', cooling: 'none', extra: 0 },
      { suffix: 'filtered', label: 'Solo filtro', filter: 'mesh', cooling: 'none', extra: 12 },
      { suffix: 'air', label: 'Aria esterna', filter: 'none', cooling: 'air', extra: 110 },
      { suffix: 'liquid', label: 'Liquido esterno', filter: 'none', cooling: 'liquid', extra: 220 },
      {
        suffix: 'filtered-air',
        label: 'Filtro + aria',
        filter: 'mesh',
        cooling: 'air',
        extra: 122,
      },
      {
        suffix: 'filtered-liquid',
        label: 'Filtro + liquido',
        filter: 'mesh',
        cooling: 'liquid',
        extra: 232,
      },
    ] as const;
    return variants.map((variant): RigModel => ({
      id: variant.suffix === 'none' ? baseId : `rig-${slots}-frame-${variant.suffix}`,
      name: `RIG ${slots} · ${variant.label}`,
      slots,
      filter: variant.filter,
      cooling: variant.cooling,
      priceEur: basePrice + variant.extra,
      researchCostEur:
        variant.suffix === 'none'
          ? slots === 4
            ? 0
            : 350
          : (slots === 4 ? 60 : 180) + variant.extra,
      parentId:
        variant.suffix === 'none'
          ? slots === 4
            ? 'rig'
            : 'rig-gameplay'
          : variant.suffix.startsWith('filtered-')
            ? `rig-${slots}-frame-${variant.cooling}`
            : baseId,
      requiredNodeIds: [
        ...(variant.filter === 'mesh' ? ['filter-mesh'] : []),
        ...(variant.cooling === 'air' ? ['fan-pressure-140'] : []),
        ...(variant.cooling === 'liquid' ? [`rig-${slots}-frame-air`] : []),
      ],
      description: `Telaio da ${slots} GPU. ${variant.filter === 'mesh' ? 'Filtro a rete incluso.' : 'Senza filtro.'} ${variant.cooling === 'none' ? 'Senza supporto esterno.' : variant.cooling === 'air' ? 'Modulo esterno a ventole incluso.' : 'Pompa e radiatore esterni inclusi.'} GPU e ventole del telaio acquistabili separatamente.`,
    }));
  })
  .concat([
    {
      id: 'rig-8-frame-bracket',
      name: 'RIG 8 · Supporto esterno',
      slots: 8,
      filter: 'none',
      cooling: 'bracket',
      priceEur: 235,
      researchCostEur: 200,
      parentId: 'rig-8-frame-none',
      requiredNodeIds: [],
      description:
        'Telaio da otto GPU con supporto esterno vuoto. Senza filtro, pompa o radiatore.',
    },
  ]);

export const RIG_MODELS_BY_ID = new Map(RIG_MODELS.map((rig) => [rig.id, rig]));

export function rigSlotCount(productId = 'rig-gameplay'): 4 | 8 {
  return RIG_MODELS_BY_ID.get(productId)?.slots ?? 4;
}

export function purchasedRigSetup(productId: string): RigSetup {
  const model = RIG_MODELS_BY_ID.get(productId)!;
  return {
    ...PURCHASED_RIG_SETUP,
    dustSystemId: model.filter,
    coolingMethodId: model.cooling === 'bracket' ? 'none' : model.cooling,
  };
}

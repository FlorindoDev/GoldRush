/** Sistemi antipolvere; efficienza e resistenza al flusso influenzano il gioco. */
export const RIG_DUST_SYSTEMS = {
  none: {
    name: 'Senza filtro',
    filterEfficiencyPercent: 0,
    airflowResistanceCelsius: 0,
  },
  mesh: {
    id: 'filter-mesh',
    name: 'Filtro magnetico a rete',
    style: 'mesh',
    filterEfficiencyPercent: 35,
    airflowResistanceCelsius: 0.8,
    dimensions: { width: 5.55, height: 1.1, depth: 0.09 },
  },
  pleated: {
    id: 'filter-pleated',
    name: 'Filtro a cartuccia pieghettata',
    style: 'pleated',
    filterEfficiencyPercent: 55,
    airflowResistanceCelsius: 1.8,
    dimensions: { width: 5.55, height: 1.1, depth: 0.23 },
  },
  carbon: {
    id: 'filter-carbon',
    name: 'Filtro a doppio strato',
    style: 'carbon',
    filterEfficiencyPercent: 75,
    airflowResistanceCelsius: 2.8,
    dimensions: { width: 5.55, height: 1.1, depth: 0.23 },
  },
} as const;

export type RigDustSystemId = keyof typeof RIG_DUST_SYSTEMS;

export const FILTER_MODELS = [
  RIG_DUST_SYSTEMS.mesh,
  RIG_DUST_SYSTEMS.pleated,
  RIG_DUST_SYSTEMS.carbon,
] as const;

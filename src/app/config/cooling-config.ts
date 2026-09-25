import { FAN_MODELS_BY_ID } from './fan-config';

/** Raffreddamento esterno; ventole, flusso, calore e assorbimento sono modificabili qui. */
export const RIG_COOLING_METHODS = {
  none: {
    name: 'Nessun modulo esterno',
    coolingCelsius: 0,
    airflowCfm: 0,
    extraPowerWatts: 0,
    radiatorFanId: null,
    radiatorFanCount: 0,
    pumpPowerWatts: 0,
    radiator: null,
  },
  air: {
    name: 'Air Wall',
    coolingCelsius: 8,
    airflowCfm: FAN_MODELS_BY_ID['fan-industrial-140'].airflowCfm * 2,
    extraPowerWatts: FAN_MODELS_BY_ID['fan-industrial-140'].powerWatts * 2,
    radiatorFanId: 'fan-industrial-140',
    radiatorFanCount: 2,
    pumpPowerWatts: 0,
    radiator: { width: 1.6, height: 2.85, depth: 0.32, fanYPositions: [1.17, 2.57] },
  },
  liquid: {
    name: 'Hydro Tower',
    coolingCelsius: 14,
    airflowCfm: FAN_MODELS_BY_ID['fan-pressure-140'].airflowCfm * 2,
    extraPowerWatts: FAN_MODELS_BY_ID['fan-pressure-140'].powerWatts * 2 + 8,
    radiatorFanId: 'fan-pressure-140',
    radiatorFanCount: 2,
    pumpPowerWatts: 8,
    radiator: { width: 1.6, height: 2.85, depth: 0.32, fanYPositions: [1.17, 2.57] },
  },
} as const;

export type RigCoolingMethodId = keyof typeof RIG_COOLING_METHODS;

export const COOLING_MODELS = [
  { id: 'cooling-bracket', name: 'Supporto esterno universale', style: 'bracket' },
  {
    id: 'cooling-air',
    name: RIG_COOLING_METHODS.air.name,
    style: 'air',
    specifications: RIG_COOLING_METHODS.air,
  },
  {
    id: 'cooling-liquid',
    name: RIG_COOLING_METHODS.liquid.name,
    style: 'liquid',
    specifications: RIG_COOLING_METHODS.liquid,
  },
] as const;

import type { FanModelId } from './fan-config';
import type { RigCoolingMethodId } from './cooling-config';
import type { RigDustSystemId } from './dust-filter-config';

export interface RigSetup {
  readonly dustSystemId: RigDustSystemId;
  readonly coolingMethodId: RigCoolingMethodId;
  readonly fanId: FanModelId;
  readonly fanCount: number;
}

export const MAX_RIG_FANS = 5;
export const STARTING_RIG_FAN_COUNT = 1;

/** Configura ventole, filtro e raffreddamento del rig iniziale. */
export const GAMEPLAY_RIG_SETUP = {
  dustSystemId: 'none',
  coolingMethodId: 'none',
  fanId: 'fan-airflow-120',
  fanCount: STARTING_RIG_FAN_COUNT,
} as const satisfies RigSetup;

/** I rig acquistati arrivano senza ventole: si installano dal banco. */
export const PURCHASED_RIG_SETUP = {
  ...GAMEPLAY_RIG_SETUP,
  fanCount: 0,
} as const satisfies RigSetup;

export const RIG_FAN_TUNING = {
  coolingCelsiusPerCfm: 0.01,
  maxCoolingCelsius: 6,
} as const;

export const GAMEPLAY_RIG_MODEL_ID =
  `rig-gameplay-${GAMEPLAY_RIG_SETUP.dustSystemId}-${GAMEPLAY_RIG_SETUP.coolingMethodId}` as const;

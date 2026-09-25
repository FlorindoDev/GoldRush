import type { FanModelId } from './fan-config';
import type { RigCoolingMethodId } from './cooling-config';
import type { RigDustSystemId } from './dust-filter-config';

/** Configura ventole, filtro e raffreddamento del rig iniziale. */
export const GAMEPLAY_RIG_SETUP = {
  dustSystemId: 'none',
  coolingMethodId: 'none',
  fanId: 'fan-airflow-120',
  fanCount: 5,
} as const satisfies {
  dustSystemId: RigDustSystemId;
  coolingMethodId: RigCoolingMethodId;
  fanId: FanModelId;
  fanCount: number;
};

export const RIG_FAN_TUNING = {
  coolingCelsiusPerCfm: 0.01,
  maxCoolingCelsius: 6,
} as const;

export const GAMEPLAY_RIG_MODEL_ID =
  `rig-gameplay-${GAMEPLAY_RIG_SETUP.dustSystemId}-${GAMEPLAY_RIG_SETUP.coolingMethodId}` as const;

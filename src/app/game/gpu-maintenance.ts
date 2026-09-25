import { GAME_BALANCE } from '../config/game-balance';
import type { GpuOperatingState } from './gpu-operation';

export type GpuFanKit = keyof typeof GAME_BALANCE.gpu.fanKits;
export type GpuMaintenanceAction =
  | { readonly kind: 'clean' }
  | { readonly kind: 'thermal' }
  | { readonly kind: 'fan'; readonly kit: GpuFanKit };

const config = GAME_BALANCE.gpu.maintenance;

export function thermalServiceHoursRemaining(gpu: GpuOperatingState): number {
  return Math.max(0, config.thermalServiceIntervalHours - gpu.hoursSinceThermalService);
}

export function dustWearMultiplier(dustPercent: number): number {
  const excess = Math.max(0, Math.min(100, dustPercent) - config.dustWearThresholdPercent);
  return (
    1 + (excess / (100 - config.dustWearThresholdPercent)) * (config.dustMaxWearMultiplier - 1)
  );
}

/** Interventi sulla singola GPU; disponibilità del banco verificata dal servizio di gioco. */
export function maintainGpu(
  gpu: GpuOperatingState,
  action: GpuMaintenanceAction,
): GpuOperatingState {
  switch (action.kind) {
    case 'clean':
      return { ...gpu, dustPercent: 0 };
    case 'thermal':
      if (thermalServiceHoursRemaining(gpu) > 0) {
        throw new Error(
          'Pasta e pad ancora recenti. Usa di nuovo questa GPU prima di sostituirli.',
        );
      }
      if (gpu.wearPercent <= 0) {
        throw new Error('Nessuna usura da rimuovere.');
      }
      return { ...gpu, wearPercent: 0, hoursSinceThermalService: 0 };
    case 'fan':
      if (!Object.hasOwn(GAME_BALANCE.gpu.fanKits, action.kit)) {
        throw new Error('Kit ventole inesistente.');
      }
      return { ...gpu, fanKit: action.kit };
  }
}

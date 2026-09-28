import { ScriptError, type ScriptObject, type Value } from '../../language/syntax';
import { isGpuOperational } from '../gpu-operation';
import type { GpuTelemetry } from '../gpu-telemetry';
import type { CryptoId } from '../../config/crypto-config';
import type { MiningGpu, MiningRig } from '../mining-world';
import { requireArguments } from './script-api-utils';
import { requireVector } from '../../language/collections/vector';
import type { MiningEstimate } from '../mining-estimate';
import { MiningEstimateScriptObject } from './mining-estimate-script-object';

/** Accesso allo stato corrente: gli oggetti script non conservano snapshot della GPU. */
export interface GpuScriptControls {
  getGpu(id: number): MiningGpu;
  getRig(id: number): MiningRig;
  getTelemetry(id: number): GpuTelemetry;
  getCryptoProgress(cryptoId: CryptoId): number;
  estimateMining(id: number, crypto?: string, frequencyGhz?: number): MiningEstimate;
  isSelected(id: number): boolean;
  setFrequencyGhz(id: number, frequencyGhz: number): void;
  setFanSpeedPercent(id: number, fanSpeedPercent: number | null): void;
  stopGpu(id: number): void;
  clearStop(id: number): void;
}

const TELEMETRY_METHODS: Readonly<Record<string, keyof GpuTelemetry>> = {
  getModel: 'model',
  getFrequencyGhz: 'frequencyGhz',
  getTargetFrequencyGhz: 'targetFrequencyGhz',
  getMinFrequencyGhz: 'minFrequencyGhz',
  getMaxFrequencyGhz: 'maxFrequencyGhz',
  getAbsoluteMaxFrequencyGhz: 'absoluteMaxFrequencyGhz',
  getPowerWatts: 'powerWatts',
  getTemperatureCelsius: 'temperatureCelsius',
  getFanSpeed: 'fanSpeed',
  getTargetFanSpeedPercent: 'targetFanSpeedPercent',
  getCurrentFanSpeedRpm: 'currentFanSpeedRpm',
  getMaxFanSpeedRpm: 'maxFanSpeedRpm',
  getMaxTemperatureCelsius: 'maxTemperatureCelsius',
  getWearPercent: 'wearPercent',
  getDustPercent: 'dustPercent',
};

export class GpuScriptObject implements ScriptObject {
  readonly objectType = 'GPU';

  constructor(
    private readonly id: number,
    private readonly controls: GpuScriptControls,
  ) {}

  getAttribute(name: string, line: number): Value {
    const gpu = this.controls.getGpu(this.id);
    switch (name) {
      case 'id':
        return this.id;
      case 'crypto':
        return gpu.cryptoId;
      case 'progress':
        return this.controls.getCryptoProgress(gpu.cryptoId);
      case 'rigId':
        return gpu.rigId;
      case 'plotId':
        return gpu.plotId;
      case 'unlocked':
        return this.isAvailable();
      case 'working':
        return this.isAvailable() && isGpuOperational(gpu);
      case 'stopped':
        return gpu.stopped;
      case 'stopReason':
        return gpu.stopReason;
      case 'selected':
        return this.isAvailable() && this.controls.isSelected(this.id);
    }
    const telemetry = this.controls.getTelemetry(this.id);
    if (Object.hasOwn(telemetry, name)) {
      return telemetry[name as keyof GpuTelemetry];
    }
    throw new ScriptError(`attributo "${name}" non disponibile per una GPU.`, line);
  }

  async callMethod(
    name: string,
    args: Value[],
    line: number,
    _parallelGroupId?: number,
  ): Promise<Value> {
    if (name === 'estimate') {
      if (
        args.length > 2 ||
        (args.length > 0 && typeof args[0] !== 'string') ||
        (args.length > 1 && typeof args[1] !== 'number')
      ) {
        throw new ScriptError(
          'estimate accetta una sigla cripto facoltativa e una frequenza numerica facoltativa.',
          line,
        );
      }
      try {
        return new MiningEstimateScriptObject(
          this.controls.estimateMining(
            this.id,
            args[0] as string | undefined,
            args[1] as number | undefined,
          ),
        );
      } catch (error) {
        throw new ScriptError(
          error instanceof Error ? error.message : 'Stima non disponibile.',
          line,
        );
      }
    }
    if (Object.hasOwn(TELEMETRY_METHODS, name)) {
      requireArguments(name, args, 0, line);
      return this.controls.getTelemetry(this.id)[TELEMETRY_METHODS[name]];
    }
    const stateAttribute = {
      isWorking: 'working',
      isSelected: 'selected',
      isStopped: 'stopped',
      getStopReason: 'stopReason',
    };
    if (Object.hasOwn(stateAttribute, name)) {
      requireArguments(name, args, 0, line);
      return this.getAttribute(stateAttribute[name as keyof typeof stateAttribute], line);
    }
    if (
      !['setFrequencyGhz', 'setFanSpeed', 'setFanSpeedAuto', 'stop', 'clearStop'].includes(name)
    ) {
      throw new ScriptError(`metodo "${name}" non disponibile per una GPU.`, line);
    }
    requireArguments(name, args, ['setFrequencyGhz', 'setFanSpeed'].includes(name) ? 1 : 0, line);
    if (!this.isAvailable()) {
      throw new ScriptError('GPU o rig bloccato.', line);
    }
    try {
      switch (name) {
        case 'stop':
          this.controls.stopGpu(this.id);
          break;
        case 'clearStop':
          this.controls.clearStop(this.id);
          break;
        case 'setFrequencyGhz':
          if (typeof args[0] !== 'number') {
            throw new Error('setFrequencyGhz richiede un numero in GHz.');
          }
          this.controls.setFrequencyGhz(this.id, args[0]);
          break;
        case 'setFanSpeed':
          if (typeof args[0] !== 'number') {
            throw new Error('setFanSpeed richiede un numero percentuale tra 0 e 100.');
          }
          this.controls.setFanSpeedPercent(this.id, args[0]);
          break;
        case 'setFanSpeedAuto':
          this.controls.setFanSpeedPercent(this.id, null);
          break;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw new ScriptError(
        error instanceof Error ? error.message : 'operazione GPU non riuscita.',
        line,
      );
    }
    return null;
  }

  toDisplayString(): string {
    return `GPU(${this.id})`;
  }

  private isAvailable(): boolean {
    const gpu = this.controls.getGpu(this.id);
    return this.controls.getRig(gpu.rigId).unlocked && gpu.unlocked;
  }
}

export function gpuIdsFromVector(value: Value, line: number, operation = 'setCrypto'): number[] {
  const vector = requireVector(value, line);
  const length = vector.getAttribute('length', line) as number;
  if (length === 0) {
    throw new ScriptError(`${operation} richiede almeno una GPU.`, line);
  }
  return Array.from({ length }, (_, index) => {
    const gpu = vector.getItem(index, line);
    if (!(gpu instanceof GpuScriptObject)) {
      throw new ScriptError(`${operation} richiede un vettore di GPU.`, line);
    }
    return gpu.getAttribute('id', line) as number;
  });
}

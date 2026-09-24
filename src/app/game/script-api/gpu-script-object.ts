import { ScriptError, type ScriptObject, type Value } from '../../language/syntax';
import { getGpuTelemetry } from '../gpu-telemetry';
import type { MiningGpu } from '../mining-world';
import { requireArguments } from './script-api-utils';

export class GpuScriptObject implements ScriptObject {
  readonly objectType = 'GPU';

  constructor(
    private readonly gpu: MiningGpu,
    private readonly rigUnlocked: boolean,
    private readonly isSelected: (gpuId: number) => boolean,
    private readonly getWorkload: () => number,
    private readonly mineGpu: (gpuId: number) => Promise<void>,
  ) {}

  getAttribute(name: string, line: number): Value {
    switch (name) {
      case 'id':
        return this.gpu.id;
      case 'rigId':
        return this.gpu.rigId;
      case 'plotId':
        return this.gpu.plotId;
      case 'unlocked':
        return this.isAvailable();
      case 'working':
        return this.isAvailable();
      case 'selected':
        return this.isAvailable() && this.isSelected(this.gpu.id);
      case 'model':
        return this.getModel();
      case 'frequencyGhz':
        return this.getFrequencyGhz();
      case 'powerWatts':
        return this.getPowerWatts();
      case 'temperatureCelsius':
        return this.getTemperatureCelsius();
      case 'fanSpeed':
        return this.getFanSpeed();
      case 'currentFanSpeedRpm':
        return this.getCurrentFanSpeedRpm();
      case 'maxFrequencyGhz':
        return this.getMaxFrequencyGhz();
      case 'maxFanSpeedRpm':
        return this.getMaxFanSpeedRpm();
      case 'maxTemperatureCelsius':
        return this.getMaxTemperatureCelsius();
      default:
        throw new ScriptError(`attributo "${name}" non disponibile per una GPU.`, line);
    }
  }

  async callMethod(name: string, args: Value[], line: number): Promise<Value> {
    switch (name) {
      case 'mine':
        requireArguments(name, args, 0, line);
        if (!this.isAvailable()) {
          throw new ScriptError('GPU o rig bloccato.', line);
        }
        try {
          await this.mineGpu(this.gpu.id);
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw error;
          }
          throw new ScriptError(
            error instanceof Error ? error.message : 'mining non riuscito.',
            line,
          );
        }
        return null;
      case 'isWorking':
        requireArguments(name, args, 0, line);
        return this.isAvailable();
      case 'isSelected':
        requireArguments(name, args, 0, line);
        return this.isAvailable() && this.isSelected(this.gpu.id);
      case 'getModel':
        requireArguments(name, args, 0, line);
        return this.getModel();
      case 'getFrequencyGhz':
        requireArguments(name, args, 0, line);
        return this.getFrequencyGhz();
      case 'getPowerWatts':
        requireArguments(name, args, 0, line);
        return this.getPowerWatts();
      case 'getTemperatureCelsius':
        requireArguments(name, args, 0, line);
        return this.getTemperatureCelsius();
      case 'getFanSpeed':
        requireArguments(name, args, 0, line);
        return this.getFanSpeed();
      case 'getCurrentFanSpeedRpm':
        requireArguments(name, args, 0, line);
        return this.getCurrentFanSpeedRpm();
      case 'getMaxFrequencyGhz':
        requireArguments(name, args, 0, line);
        return this.getMaxFrequencyGhz();
      case 'getMaxFanSpeedRpm':
        requireArguments(name, args, 0, line);
        return this.getMaxFanSpeedRpm();
      case 'getMaxTemperatureCelsius':
        requireArguments(name, args, 0, line);
        return this.getMaxTemperatureCelsius();
      default:
        throw new ScriptError(`metodo "${name}" non disponibile per una GPU.`, line);
    }
  }

  toDisplayString(): string {
    return `GPU(${this.gpu.id})`;
  }

  private getModel(): string {
    return this.telemetry().model;
  }

  private getFrequencyGhz(): number {
    return this.telemetry().frequencyGhz;
  }

  private getPowerWatts(): number {
    return this.telemetry().powerWatts;
  }

  private getTemperatureCelsius(): number {
    return this.telemetry().temperatureCelsius;
  }

  private getFanSpeed(): number {
    return this.telemetry().fanSpeed;
  }

  private getCurrentFanSpeedRpm(): number {
    return this.telemetry().currentFanSpeedRpm;
  }

  private getMaxFrequencyGhz(): number {
    return this.telemetry().maxFrequencyGhz;
  }

  private getMaxFanSpeedRpm(): number {
    return this.telemetry().maxFanSpeedRpm;
  }

  private getMaxTemperatureCelsius(): number {
    return this.telemetry().maxTemperatureCelsius;
  }

  private telemetry() {
    return getGpuTelemetry(this.getWorkload());
  }

  private isAvailable(): boolean {
    return this.rigUnlocked && this.gpu.unlocked;
  }
}

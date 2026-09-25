import { ScriptError, type ScriptObject, type Value } from '../../language/syntax';
import { requireArguments } from './script-api-utils';

export interface ElectricityReadings {
  readonly powerWatts: number;
  readonly energyKwh: number;
  readonly pendingCostEur: number;
  readonly totalCostEur: number;
  readonly pricePerKwh: number;
}

const METHODS: Readonly<Record<string, keyof ElectricityReadings>> = {
  getPowerWatts: 'powerWatts',
  getEnergyKwh: 'energyKwh',
  getPendingCostEur: 'pendingCostEur',
  getTotalCostEur: 'totalCostEur',
  getPricePerKwh: 'pricePerKwh',
};

export class ElectricityScriptObject implements ScriptObject {
  readonly objectType = 'electricity';

  constructor(private readonly read: () => ElectricityReadings) {}

  getAttribute(name: string, line: number): Value {
    const readings = this.read();
    if (!Object.hasOwn(readings, name)) {
      throw new ScriptError(`attributo "${name}" non disponibile per electricity.`, line);
    }
    return readings[name as keyof ElectricityReadings];
  }

  callMethod(name: string, args: Value[], line: number): Value {
    if (!Object.hasOwn(METHODS, name)) {
      throw new ScriptError(`metodo "${name}" non disponibile per electricity.`, line);
    }
    requireArguments(name, args, 0, line);
    return this.getAttribute(METHODS[name], line);
  }

  toDisplayString(): string {
    return 'Electricity';
  }
}

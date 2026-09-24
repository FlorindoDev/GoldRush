export interface GpuTelemetry {
  readonly model: string;
  readonly frequencyGhz: number;
  readonly powerWatts: number;
  readonly temperatureCelsius: number;
  readonly fanSpeed: number;
  readonly currentFanSpeedRpm: number;
  readonly maxFrequencyGhz: number;
  readonly maxFanSpeedRpm: number;
  readonly maxTemperatureCelsius: number;
}

const GPU_MODEL = 'Blockcraft Miner X1';
const MAX_FREQUENCY_GHZ = 2;
const MAX_FAN_SPEED_RPM = 3200;
const MAX_TEMPERATURE_CELSIUS = 90;

const IDLE_TELEMETRY = {
  frequencyGhz: 0.5,
  powerWatts: 32,
  temperatureCelsius: 34,
  fanSpeed: 20,
};

const MINING_TELEMETRY = {
  frequencyGhz: 1.8,
  powerWatts: 205,
  temperatureCelsius: 72,
  fanSpeed: 70,
};

export function getGpuTelemetry(workload: number): GpuTelemetry {
  const load = Math.min(1, Math.max(0, workload));
  const frequencyGhz = interpolate(
    IDLE_TELEMETRY.frequencyGhz,
    MINING_TELEMETRY.frequencyGhz,
    load,
  );
  const fanSpeed = Math.round(
    interpolate(IDLE_TELEMETRY.fanSpeed, MINING_TELEMETRY.fanSpeed, load),
  );

  return {
    model: GPU_MODEL,
    frequencyGhz: round(frequencyGhz, 2),
    powerWatts: Math.round(
      interpolate(IDLE_TELEMETRY.powerWatts, MINING_TELEMETRY.powerWatts, load),
    ),
    temperatureCelsius: Math.round(
      interpolate(IDLE_TELEMETRY.temperatureCelsius, MINING_TELEMETRY.temperatureCelsius, load),
    ),
    fanSpeed,
    currentFanSpeedRpm: Math.round((MAX_FAN_SPEED_RPM * fanSpeed) / 100),
    maxFrequencyGhz: MAX_FREQUENCY_GHZ,
    maxFanSpeedRpm: MAX_FAN_SPEED_RPM,
    maxTemperatureCelsius: MAX_TEMPERATURE_CELSIUS,
  };
}

function interpolate(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

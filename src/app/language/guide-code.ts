export const GUIDE_CODE = {
  optimization: `// Ottimizza una scheda: margine stimato per azione, poi controllo del calore.
let cards = plots[0].rigs[0].gpus.slice(0, 1);
let gpu = cards[0];
while (gpu.progress < 100 && gpu.isWorking()) {
  let bestClock = gpu.getMinFrequencyGhz();
  let best = gpu.estimate(gpu.crypto, bestClock);
  for (let clock = bestClock + 0.1; clock <= gpu.getMaxFrequencyGhz(); clock = clock + 0.1) {
    let candidate = gpu.estimate(gpu.crypto, clock);
    if (candidate.profitPerActionEur > best.profitPerActionEur) {
      best = candidate;
      bestClock = clock;
    }
  }
  if (gpu.getTemperatureCelsius() > 80 && bestClock > gpu.getTargetFrequencyGhz()) {
    bestClock = gpu.getTargetFrequencyGhz();
  }
  gpu.setFrequencyGhz(bestClock);
  mine(cards, false);
}
print("Progresso: " + gpu.progress);`,
  functionsExample: `mine();
print("Progresso: " + progress());`,
  gpuLocation: 'let gpu = plots[0].rigs[0].gpus[0];',
  gpuMining: 'mine();',
  gpuExample: `let gpu = plots[0].rigs[0].gpus[0];
print(gpu.getModel());
print(gpu.getTemperatureCelsius() + " °C");
print(gpu.getFanSpeed() + "%");`,
  cryptoAssignment: `// Installa quattro GPU e sblocca KAS e LTC nell'albero ricerca.
let gpus = plots[0].rigs[0].gpus;
setCrypto(gpus.slice(0, 2), "KAS");
setCrypto(gpus.slice(2, 4), "LTC");
mine(gpus.slice(0, 2), "Avvio Kaspa", 10);
mine(gpus.slice(2, 4), false);`,
  energyExample: `let gpu = plots[0].rigs[0].gpus[0];
print(electricity.getPricePerKwh());
gpu.setFrequencyGhz(gpu.getMaxFrequencyGhz());
mine();
print(electricity.getEnergyKwh());
print(electricity.getPendingCostEur());
gpu.stop();`,
  variable: `let obiettivo = 100;
obiettivo = obiettivo - 20;
let i = 0; i++;`,
  functionDefinition: `def doppio(numero) {
  return numero * 2;
}
print(doppio(3));`,
  fileImport: `import * from "utilita.mine";
print(doppio(3));
print(triplo(3));`,
  fileImportSelected: `import { doppio } from "utilita.mine";
print(doppio(3));`,
  fileLibrary: `def doppio(numero) {
  return numero * 2;
}

def triplo(numero) {
  return numero * 3;
}`,
  parallel: `let gpuUno = plots[0].rigs[0].gpus[0];
let gpuDue = plots[0].rigs[0].gpus[1];

parallel {
  gpuUno.setFrequencyGhz(gpuUno.getMaxFrequencyGhz());
  gpuDue.setFrequencyGhz(gpuDue.getMaxFrequencyGhz());
}`,
  condition: `if (progress() == 100) {
  print("Blocco completato");
} else {
  mine();
}`,
} as const;

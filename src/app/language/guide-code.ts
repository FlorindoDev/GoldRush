export const GUIDE_CODE = {
  functionsExample: `mine();
print("Progresso: " + progress());`,
  gpuLocation: 'let gpu = plots[0].rigs[0].gpus[0];',
  gpuMining: 'mine();',
  gpuExample: `let gpu = plots[0].rigs[0].gpus[0];
print(gpu.getModel());
print(gpu.getTemperatureCelsius() + " °C");
print(gpu.getFanSpeed() + "%");`,
  cryptoAssignment: `// Sblocca prima KAS e LTC nell'albero ricerca.
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
  fileImport: `import "utilita.mine";
print("Risultato: " + doppio(3));`,
  fileLibrary: `def doppio(numero) {
  return numero * 2;
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

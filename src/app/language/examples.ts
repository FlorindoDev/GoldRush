import { MINE_PROGRESS_PER_GPU, STARTING_GPU_COUNT } from '../game/mining-world';

const MINES_PER_BLOCK = Math.ceil(100 / (MINE_PROGRESS_PER_GPU * Math.max(1, STARTING_GPU_COUNT)));

export const EXAMPLES = [
  {
    name: 'Il primo blocco',
    code: `// Il tuo primo algoritmo di mining
while (progress() < 100) {
  mine();
}

print("Blocco completato!");`,
  },
  {
    name: 'Mining multi-cripto',
    code: `// Un vettore di GPU per ogni cripto.
let gpus = plots[0].rigs[0].gpus;
setCrypto(gpus.slice(0, 2), "KAS");
setCrypto(gpus.slice(2, 4), "LTC");
print(gpus[0].crypto);
print("Progresso KAS: " + progress("KAS"));
// Le altre GPU mantengono la loro assegnazione (BTC inizialmente).
// mine() senza vettore avvia tutte le GPU operative: ognuna mina la propria cripto.
while (progress() < 100) {
  mine();
}`,
  },
  {
    name: 'GPU selezionate e messaggi',
    code: `let gpus = plots[0].rigs[0].gpus;
setCrypto(gpus.slice(0, 2), "KAS");
mine(gpus.slice(0, 2), "Mining Kaspa");
// Solo queste GPU minano, senza messaggi di progresso o ricompensa.
mine(gpus.slice(2, 4), false);`,
  },
  {
    name: 'Ciclo for',
    code: `// Con tutte le GPU iniziali operative servono circa ${MINES_PER_BLOCK} chiamate a mine().
for (let i = 0; i < ${MINES_PER_BLOCK}; i++) {
  mine();
  print("Passo " + (i + 1) + "/${MINES_PER_BLOCK}");
}`,
  },
  {
    name: 'Ciclo while',
    code: `// Continua finché il blocco è completo.
while (progress() < 100) {
  mine();
  wait(200);
}

print("Mining completato!");`,
  },
  {
    name: 'Controlli GPU in parallelo',
    code: `// mine() avvia già tutte le GPU sbloccate insieme.
let gpuUno = plots[0].rigs[0].gpus[0];
let gpuDue = plots[0].rigs[0].gpus[1];

parallel {
  gpuUno.setFrequencyGhz(gpuUno.getMaxFrequencyGhz());
  gpuDue.setFrequencyGhz(gpuDue.getMaxFrequencyGhz());
}

print("Frequenze aggiornate insieme.");`,
  },
  {
    name: 'Variabili e condizioni',
    code: `let obiettivo = 100;
if (progress() < obiettivo) {
  while (progress() < obiettivo) {
    mine();
  }
} else {
  print("Avvia di nuovo per passare al blocco successivo.");
}`,
  },
  {
    name: 'Vettori, pila, coda e farm',
    code: `let valori = vector();
valori.push(8);
valori.insert(0, 4);
print("Primo valore: " + valori[0]);

let pila = stack();
pila.push(valori);
let coda = queue();
coda.enqueue(pila.pop());
print("Lunghezza del vettore in coda: " + coda.peek().length);

let plot = plots[0];
let rig = plot.rigs[0];
let gpu = rig.gpus[0];
print("Farm: " + plots.length + " plot");
print("Plot " + plot.id + ", rig " + rig.id + ", GPU " + gpu.id);`,
  },
  {
    name: 'Telemetria GPU',
    code: `let gpu = plots[0].rigs[0].gpus[0];
print("Modello: " + gpu.getModel());
print("Frequenza: " + gpu.getFrequencyGhz() + " / " + gpu.getMaxFrequencyGhz() + " GHz");
print("Consumo: " + gpu.getPowerWatts() + " W");
print("Temperatura: " + gpu.getTemperatureCelsius() + " / " + gpu.getMaxTemperatureCelsius() + " C");
print("Ventole: " + gpu.getFanSpeed() + "% · " + gpu.getCurrentFanSpeedRpm() + " / " + gpu.getMaxFanSpeedRpm() + " RPM");`,
  },
  {
    name: 'Corrente e costo del mining',
    code: `print("Tariffa: " + electricity.getPricePerKwh() + " EUR/kWh");
mine();
print("Energia: " + electricity.getEnergyKwh() + " kWh");
print("Bolletta pendente: " + electricity.getPendingCostEur() + " EUR");
print("Costo totale: " + electricity.getTotalCostEur() + " EUR");`,
  },
  {
    name: 'Overclock, usura e stop',
    code: `let gpu = plots[0].rigs[0].gpus[0];
print("Limiti GHz: " + gpu.getMinFrequencyGhz() + " / " + gpu.getMaxFrequencyGhz() + " / " + gpu.getAbsoluteMaxFrequencyGhz());
gpu.setFrequencyGhz(gpu.getMaxFrequencyGhz());
if (gpu.isStopped()) {
  wait(5000);
  gpu.clearStop();
}
repeat (3) {
  if (gpu.isWorking()) {
    mine();
    print("Calore: " + gpu.getTemperatureCelsius() + " C");
    print("Usura: " + gpu.getWearPercent() + "%");
  }
}
gpu.stop();
print(gpu.getStopReason());
// Per riabilitare: gpu.clearStop(); poi mine();`,
  },
] as const;

export const LANGUAGE_GUIDE_EXAMPLE = `let gpu = plots[0].rigs[0].gpus[0];

repeat (2) {
  mine();
}

for (let i = 0; i < 2; i++) {
  mine();
}

while (progress() < 100) {
  mine();
}

let gpuDue = plots[0].rigs[0].gpus[1];
parallel {
  gpu.setFrequencyGhz(gpu.getMaxFrequencyGhz());
  gpuDue.setFrequencyGhz(gpuDue.getMaxFrequencyGhz());
}

let obiettivo = 100;
if (progress() == obiettivo) {
  print("Missione compiuta!");
} else {
  print("Ancora al lavoro.");
}`;

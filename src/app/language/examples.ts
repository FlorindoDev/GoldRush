import { MINE_PROGRESS_PER_GPU } from '../game/mining-world';

const MINES_PER_BLOCK = Math.ceil(100 / MINE_PROGRESS_PER_GPU);

export const EXAMPLES = [
  {
    name: 'Il primo blocco',
    code: `// Il tuo primo algoritmo di mining
// Inizia con una GPU sbloccata. Le altre sono bloccate.
let gpu = plots[0].rig(0).gpu(0);
while (progress() < 100) {
  gpu.mine();
}

print("Blocco completato!");`,
  },
  {
    name: 'Ciclo for',
    code: `// Con una GPU servono ${MINES_PER_BLOCK} chiamate a gpu.mine().
let gpu = plots[0].rig(0).gpu(0);
for (let i = 0; i < ${MINES_PER_BLOCK}; i++) {
  gpu.mine();
  print("Passo " + (i + 1) + "/${MINES_PER_BLOCK}");
}`,
  },
  {
    name: 'Ciclo while',
    code: `// Continua finché il blocco è completo.
let gpu = plots[0].rig(0).gpu(0);
while (progress() < 100) {
  gpu.mine();
  wait(200);
}

print("Mining completato!");`,
  },
  {
    name: 'Variabili e condizioni',
    code: `let obiettivo = 100;
let gpu = plots[0].rig(0).gpu(0);

if (progress() < obiettivo) {
  while (progress() < obiettivo) {
    gpu.mine();
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
let rig = plot.rig(0);
let gpu = rig.gpu(0);
print("Farm: " + plots.length + " plot");
print("Plot " + plot.id + ", rig " + rig.id + ", GPU " + gpu.id);`,
  },
  {
    name: 'Telemetria GPU',
    code: `let gpu = plots[0].rig(0).gpu(0);
print("Modello: " + gpu.getModel());
print("Frequenza: " + gpu.getFrequencyGhz() + " / " + gpu.getMaxFrequencyGhz() + " GHz");
print("Consumo: " + gpu.getPowerWatts() + " W");
print("Temperatura: " + gpu.getTemperatureCelsius() + " / " + gpu.getMaxTemperatureCelsius() + " C");
print("Ventole: " + gpu.getFanSpeed() + "% · " + gpu.getCurrentFanSpeedRpm() + " / " + gpu.getMaxFanSpeedRpm() + " RPM");`,
  },
] as const;

export const LANGUAGE_GUIDE_EXAMPLE = `let gpu = plots[0].rig(0).gpu(0);

repeat (2) {
  gpu.mine();
}

for (let i = 0; i < 2; i++) {
  gpu.mine();
}

while (progress() < 100) {
  gpu.mine();
}

let obiettivo = 100;
if (progress() == obiettivo) {
  print("Missione compiuta!");
} else {
  print("Ancora al lavoro.");
}`;

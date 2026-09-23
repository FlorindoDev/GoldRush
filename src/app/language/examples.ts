export const EXAMPLES = [
  {
    name: 'Il primo blocco',
    code: `// Il tuo primo algoritmo di mining
// Ogni mine() completa il 20% del blocco.

repeat (5) {
  mine();
}

print("Blocco completato!");`,
  },
  {
    name: 'Ciclo for',
    code: `// Cinque passi, una GPU.
for (let i = 0; i < 5; i++) {
  mine();
  print("Passo " + (i + 1));
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
    name: 'Variabili e condizioni',
    code: `let obiettivo = 100;

if (progress() < obiettivo) {
  while (progress() < obiettivo) {
    mine();
  }
} else {
  print("Sblocca un nuovo blocco!");
}`,
  },
] as const;

export const LANGUAGE_GUIDE_EXAMPLE = `repeat (5) {
  mine();
}

for (let i = 0; i < 5; i++) {
  mine();
}

while (progress() < 100) {
  mine();
}

let obiettivo = 100;
if (progress() == obiettivo) {
  print("Missione compiuta!");
} else {
  print("Ancora al lavoro.");
}`;

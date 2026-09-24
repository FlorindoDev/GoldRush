# Blockcraft

Prototipo di gioco Angular + Three.js: scrivi MineScript per gestire una farm GPU su una mappa 3D low poly. Mining e BTC sono simulati.

## Avvio

Richiede Node.js 24.15+ (24.x) e npm.

```sh
npm install
npm start
```

In Windows PowerShell, se l'esecuzione di `npm.ps1` è bloccata, usa `npm.cmd start` (e `npm.cmd` al posto di `npm` per gli altri comandi).

Apri **http://localhost:4200**. I valori iniziali della farm, il progresso per chiamata e il premio sono in `src/app/config/game-balance.ts`. Le GPU sbloccate e le ventole girano durante il mining. Clicca una GPU sbloccata o il pulsante numerato per trasferirla alla workbench; la freccia la rimette sul quadrato. Completare un blocco non sblocca rig o GPU.

```sh
npm run build       # Produzione in dist/blockcraft/browser
npm test           # Interprete, regole di gioco, escaping dell'editor
npm run test:e2e    # Browser Microsoft Edge; avvia automaticamente il server
```

I test browser usano Edge installato. Per altri sistemi cambia `channel` in `playwright.config.ts` o installa Chromium con `npx playwright install chromium` e rimuovi `channel`.

## Stile del codice

TypeScript, HTML e CSS usano indentazione di due spazi e formattazione Prettier. Ogni componente ha file separati per logica, template e stile. Le istruzioni condizionali usano sempre parentesi graffe; i metodi sono separati da una riga vuota.

```sh
npm run format        # Formatta i sorgenti e la configurazione
npm run format:check  # Controlla la formattazione senza modificare file
```

Per orientarti: `src/app/hud/hud.component.ts` coordina la UI sovrapposta; `src/app/scene/scene.component.ts` collega HUD e rendering Three.js, mentre `src/app/scene/mining-scene.ts` coordina scena e interazioni. `scene/gpu-visuals.ts` gestisce istanze GPU, caricamento, ventole, trasferimenti e rilascio del modello condiviso. `scene/camera/camera-focus.ts` sceglie target e offset; `SceneCameraController` applica il movimento. Le transizioni condivise sono in `scene/animation/`, il rilascio delle risorse Three.js in `scene/resources/`.

## Bilanciamento

Modifica `src/app/config/game-balance.ts`. I gruppi `world`, `gpu`, `mining`, `scripting`, `camera`, `animation`, `scene`, `layout` e `toolStations` raccolgono i valori modificabili. Frequenze, temperature, consumi e ventole hanno profili `idle` e `mining` e limiti in `gpu.limits`. Tempi sono in millisecondi, la transizione in secondi, gli angoli polari in radianti e il campo visivo in gradi. Le capacità totali e il progresso per GPU derivano dalle dimensioni della farm; guida ed esempio del ciclo `for` si aggiornano con questi valori. Dopo modifiche al numero di rig o slot, verifica che i modelli 3D restino dentro i plot.

## Moduli

Componenti Angular standalone organizzati per funzionalità; nessun NgModule necessario.

| Directory                      | Responsabilità                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `src/app/config`               | Parametri di bilanciamento della partita e della scena                                   |
| `src/app/game`                 | Stato reattivo, regole pure della partita, selezione, saldo in satoshi, esecuzione e log |
| `src/app/game/script-api`      | Oggetti MineScript per plot, rig e GPU                                                   |
| `src/app/language`             | Lexer, parser, AST, interprete e valori runtime                                          |
| `src/app/language/collections` | Vettori modificabili, pile e code di vettori                                             |
| `src/app/scene`                | Rendering Three.js, blocchi, modello GPU, camera, selezione e gestione risorse           |
| `src/app/hud`                  | Punto centrale HUD: finestre, indicatori, controlli e icone                              |
| `src/app/hud/panels`           | Editor e console, ciascuno nella propria sottocartella                                   |
| `src/app/hud/controls`         | Comandi HUD della scena e della camera                                                   |
| `src/app/hud/icons`            | Icone riutilizzabili per interfaccia                                                     |
| `src/app/hud/indicators`       | Indicatori visivi, come il modello Bitcoin                                               |
| `src/app/scene/models`         | Costruzione e preparazione dei modelli Three.js                                          |
| `src/app/scene/geometry`       | Primitive geometriche riutilizzate da modelli e strumenti                                |
| `src/app/assets/models`        | Percorsi degli asset 3D usati da HUD e scena                                             |
| `modelli/`                     | File GLTF, BIN e licenze originali, copiati sotto `/models` in build                     |

`GameService` coordina dominio e interprete; `MiningScene` riceve uno snapshot del mondo. `shared` indicava codice riutilizzabile, ma mescolava elementi diversi: ora ogni elemento vive nella cartella della sua responsabilità. I percorsi dei file 3D sono in `assets/models`, la logica dei modelli in `scene/models`, le forme riutilizzabili in `scene/geometry`.

## MineScript

```js
// Completa il blocco attivo, anche se già parzialmente estratto.
let gpu = plots[0].rig(0).gpu(0);
while (progress() < 100) {
  gpu.mine();
  print('Progresso: ' + progress() + '%');
}
```

- `gpu.mine()`: lavora solo con la GPU specificata e aggiunge il progresso configurato al blocco attivo. Il premio viene assegnato solo al raggiungimento del 100%.
- `progress()`: progresso attuale, 0–100.
- `print(valore)`: scrive in console.
- `wait(ms)`: pausa interrompibile entro il limite configurato. La velocità 2× riguarda solo `gpu.mine()`.
- `repeat(n) { ... }`: intero non negativo entro il limite configurato.
- `for (let i = 0; i < 5; i++) { ... }`, `while (...) { ... }`, `if (...) { ... } else { ... }`.
- Variabili `let`, assegnazione, `++`, `--`, numeri, stringhe, booleani, vettori, attributi, metodi, `+ - * / %`, confronti `== != < <= > >=`, `&& || !` e parentesi.
- Commenti `//`; punto e virgola obbligatorio per istruzioni semplici. Variabili in un unico ambito per esecuzione; vengono azzerate al run successivo. Le dichiarazioni dentro i cicli possono riassegnarle.

### Vettori e farm

- `vector()` crea un vettore modificabile: `push`, `pop`, `get`, `set`, `insert`, `remove`, `contains`, `indexOf`, `concat`, `slice`, `copy`, `reverse`, `sort`, `clear`, `isEmpty`; attributi `length`, `first` e `last`. Indici da zero; capienza in `scripting.maxCollectionSize`. `sort()` accetta vettori omogenei di numeri o stringhe.
- `stack()` crea una pila LIFO di vettori, con `push`, `pop`, `peek`, `size`, `isEmpty` e `clear`.
- `queue()` crea una coda FIFO di vettori, con `enqueue`, `dequeue`, `peek`, `front`, `back`, `size`, `isEmpty` e `clear`.
- `plots` è il vettore di sola lettura della farm, con capacità definite in `world`. Usa `plots[0].rig(0).gpu(0)` per accedere al primo elemento a ogni livello. Plot espone `id`, `rigs`, `rigCount`, `gpuCount` (sbloccate), `gpuCapacity`; rig espone `id`, `plotId`, `unlocked`, `gpus`, `gpuCount` (sbloccate), `gpuCapacity`.
- Tutti gli oggetti espongono `type`.
- `null` rappresenta un contenitore vuoto quando `pop`, `peek` o `dequeue` non trova elementi. La capienza delle collezioni è configurabile.

### GPU

Accedi a una GPU tramite `plots[plotIndex].rig(rigIndex).gpu(gpuIndex)` oppure indicizza il vettore `gpus`. Gli indici partono da zero. GPU è utilizzabile solo se è sbloccato anche il rig. Non esistono ancora metodi per sbloccare o configurare l'hardware.

| Attributo               | Getter MineScript            | Significato                     |
| ----------------------- | ---------------------------- | ------------------------------- |
| `model`                 | `getModel()`                 | Modello configurato             |
| `frequencyGhz`          | `getFrequencyGhz()`          | Frequenza attuale in GHz        |
| `powerWatts`            | `getPowerWatts()`            | Consumo attuale in W            |
| `temperatureCelsius`    | `getTemperatureCelsius()`    | Temperatura attuale in °C       |
| `fanSpeed`              | `getFanSpeed()`              | Velocità ventole in percentuale |
| `currentFanSpeedRpm`    | `getCurrentFanSpeedRpm()`    | Velocità attuale ventole in RPM |
| `maxFrequencyGhz`       | `getMaxFrequencyGhz()`       | Frequenza massima configurata   |
| `maxFanSpeedRpm`        | `getMaxFanSpeedRpm()`        | Velocità massima configurata    |
| `maxTemperatureCelsius` | `getMaxTemperatureCelsius()` | Temperatura massima configurata |

GPU espone anche `id`, `rigId`, `plotId`, `unlocked`, `working` e `selected`, oltre a `type` che vale `GPU`. I metodi `isWorking()` e `isSelected()` corrispondono agli attributi `working` e `selected`. Per ora `working` indica che GPU e rig sono sbloccati, non che stiano minando in quell'istante; `selected` indica che GPU è al banco.

La telemetria è simulata sul carico complessivo: i valori di riposo e mining sono in `gpu.idle` e `gpu.mining`. La telemetria scende durante il raffreddamento.

```js
let gpu = plots[0].rig(0).gpu(0);
print(gpu.getModel());
print(gpu.getFrequencyGhz() + ' / ' + gpu.getMaxFrequencyGhz() + ' GHz');
print(gpu.getPowerWatts() + ' W');
print(gpu.getTemperatureCelsius() + ' / ' + gpu.getMaxTemperatureCelsius() + ' °C');
print(
  gpu.getFanSpeed() +
    '% · ' +
    gpu.getCurrentFanSpeedRpm() +
    ' / ' +
    gpu.getMaxFanSpeedRpm() +
    ' RPM',
);
```

L'interprete analizza il programma prima di eseguirlo. Non usa `eval`, `Function` né accesso alle API del browser. I limiti sono in `scripting` e `editor.maxLogEntries`. Gli errori riportano la riga. Un errore di runtime conserva le azioni già completate. Stop annulla anche il mining pendente senza attribuire ricompense.

## Interazione e limiti del prototipo

- Trascina per ruotare, rotella per zoomare; seleziona la GPU montata nel rig sbloccato o usa i pulsanti accessibili. La selezione sposta la GPU al banco; il ritorno la rimonta nel rig. Camera e GPU si muovono insieme, rispettando la preferenza di movimento ridotto del browser.
- All'avvio è mostrato il primo rig con GPU 1; gli altri rig restano bloccati e sono rappresentati dai quadrati a terra. Non esiste ancora un metodo per sbloccare rig o GPU. Completare blocchi non aggiunge hardware. Il banco resta un singolo arredo sulla destra. La GPU esaminata è distinta dal blocco attivo del programma.
- Ctrl/Cmd + Invio esegue; Tab aggiunge due spazi; Esc poi Tab permette di uscire dall'editor. Durante il run, codice e selezione sono bloccati.
- Il codice viene salvato in `localStorage` se disponibile; la partita resta in memoria. Ricaricando la pagina si riparte dal primo blocco. **Nuova partita** mantiene il codice.
- Nessun backend, account, mining reale o economia di acquisto.
- Serve WebGL2 per la scena. Se non disponibile, il gioco rimane utilizzabile tramite i controlli testuali. Font, modelli e dipendenze sono serviti localmente.

## Crediti

This work is based on [“GPU Low Poly”](https://sketchfab.com/3d-models/gpu-low-poly-934115a6f28440668b5ff70aa5a88b1d) by [N1shor](https://sketchfab.com/N1shor), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modifiche in scena: scala, orientamento e colore. File originali e licenza in `modelli/modello-gpu/`.

This work is based on [“Low Poly Bitcoin”](https://sketchfab.com/3d-models/low-poly-bitcoin-ec0b85df2dde42eda90b571c12a7cd47) by [Gohar.Munir](https://sketchfab.com/Gohar.Munir), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modifiche in scena: scala e orientamento. File originali e licenza in `modelli/bitcoin/`.

Font DM Sans e IBM Plex Mono distribuiti tramite i rispettivi pacchetti Fontsource, con licenze incluse. Geometrie dei blocchi e icone del progetto create in codice.

Il banco da elettronico è un modello originale costruito in Three.js: piano in legno, telaio metallico, cassetti, tappetino antistatico, oscilloscopio, saldatore, lampada e pannello porta attrezzi. Riferimenti consultati per tipologia e stile: [Workbench low-poly di MaX3Dd](https://sketchfab.com/3d-models/workbench-low-poly-01c0b5991ad448ed917845df202867c2) e [Workbench su Free3D](https://free3d.com/3d-model/workbench-6290.html). Nessuna geometria o texture di questi modelli è inclusa nel progetto.

Riferimenti: [compatibilità Angular](https://angular.dev/reference/versions), [documentazione Three.js](https://threejs.org/docs/).

Il modello del mining rig è costruito in Three.js e mostrato nella scena con GPU 1 montata; le piazzole bloccate sono quadrati a terra. I riferimenti consultati sono [Crypto Farm / Mining Rig di Michael V](https://sketchfab.com/3d-models/crypto-farm-mining-rig-049f02ffd15c41ca8cb8020feb43993f), [Mining Rig di Cem Gürbüz](https://sketchfab.com/3d-models/mining-rig-a131eb6aca5f4b4fb16d6572a853912e) e [Mining Rig Frame 6x video card](https://sketchfab.com/3d-models/mining-rig-frame-6x-video-card-3e83a16d2b2c4d7398389afdcd752a08). Nessuna geometria o texture dei rig di riferimento è inclusa.

# Blockcraft

Prototipo di gioco Angular + Three.js: scrivi MineScript per gestire una farm GPU su una mappa 3D low poly. Mining e BTC sono simulati.

## Avvio

Richiede Node.js 24.15+ (24.x) e npm.

```sh
npm install
npm start
```

In Windows PowerShell, se l'esecuzione di `npm.ps1` è bloccata, usa `npm.cmd start` (e `npm.cmd` al posto di `npm` per gli altri comandi).

Apri **http://localhost:4200**. Le configurazioni della farm sono in `src/app/config`; `game-balance.ts` le compone. Le GPU sbloccate e le ventole girano durante il mining. Un clic sulla GPU o sul pulsante numerato la seleziona; un doppio clic la trasferisce alla workbench. La freccia la rimette sul quadrato mantenendo la selezione. Completare un blocco non sblocca rig o GPU.

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

`src/app/config/game-balance.ts` compone i gruppi di configurazione usati dal gioco. Modifica il file del componente che vuoi bilanciare:

- `gpu-config.ts`: profilo idle/mining, limiti, calore, usura e danni della polvere per ogni GPU. In `specifications.dustDamage` regoli accumulo relativo (`dustBuildUpMultiplier`), calore aggiuntivo massimo (`maxExtraHeatCelsius`), velocità di riscaldamento (`maxHeatingResponseBonus`), soglia d'usura (`wearThresholdPercent`) e usura massima (`maxWearMultiplier`). `GPU_DEFAULT_MODEL_ID` sceglie GPU di partenza.
- `fan-config.ts`: specifiche e geometria di ogni ventola; `GPU_FAN_KITS` configura i kit GPU.
- `cooling-config.ts`: potenza, portata e riduzione termica dei metodi di raffreddamento del rig.
- `dust-filter-config.ts`: efficienza, resistenza al flusso e dimensioni dei filtri antipolvere.
- `rig-config.ts`: ventola, filtro e raffreddamento selezionati per il rig iniziale (`GAMEPLAY_RIG_SETUP`).
- `world-config.ts` e `economy-config.ts`: capacità della farm, progressione, ricompense, prezzi e tempo simulato.
- `scene-config.ts`: camera, animazioni, superfici e dimensioni della scena.
- `runtime-config.ts`: limiti di editor e interprete MineScript.

La selezione iniziale di filtro e raffreddamento influenza sia il rig caricato sia accumulo di polvere, temperatura e consumi. Dopo modifiche a dimensioni o geometrie dei modelli, rigenera i GLB con `npm run models:generate`. Tempi sono in millisecondi, transizioni in secondi e temperature in °C.

## Moduli

### Banco di lavoro

Il doppio clic su una GPU apre il pannello officina a destra. Editor e console ricompaiono quando la scheda viene rimontata nel rig.

- **Pulizia:** rimuove lo sporco, che cresce solo durante il lavoro della singola GPU. Più polvere significa riscaldamento più rapido; soglia e danni cambiano in base al profilo `dustDamage` della GPU in `gpu-config.ts` (la GPU iniziale supera la soglia al 60% e arriva a 3 volte l'usura al 100%). La velocità base di accumulo si regola in `GPU_RUNTIME_CONFIG.maintenance.dustPercentPerHour`; il filtro del rig la riduce.
- **Pasta e pad:** azzerano l'usura. Dopo ogni intervento servono 24 ore simulate di mining sulla stessa scheda prima di ripeterlo. Le azioni interrotte contano in proporzione; attesa, banco e lavoro delle altre GPU non contano.
- **Ventole:** kit originale, alta portata (+12 W, −9 °C), industriale (+24 W, −15 °C) e Server Jet (+40 W, −21 °C). La velocità manuale e il ritorno alla modalità automatica si impostano con MineScript; HUD e banco mostrano la telemetria senza comandi di velocità.
- **Effetti 3D:** deposito di polvere, particelle durante la pulizia, scie e tinta calda sopra 78 °C, dettagli dei kit ventole. Ogni istanza ha effetti indipendenti, conserva gli interventi tornando nel rig e rispetta la preferenza di movimento ridotto.

Una GPU sul banco non può minare. Mentre è sul banco, la temperatura si raffredda gradualmente fino a 0 °C; la durata si configura in `gpu.benchCoolingMs`. Dopo un arresto per calore o usura va riabilitata, una volta raffreddata o riparata. Regole condivise in `gpu.maintenance`, danni della polvere per modello in `gpu.dustDamage` e kit in `gpu.fanKits` di `game-balance.ts`. Stato della partita mantenuto in memoria, come nel resto del prototipo.

Regole pure in `game/gpu-maintenance.ts`, UI in `hud/panels/workbench`, effetti adattati ai limiti del modello in `scene/gpu-condition-effects.ts`. Geometrie e texture restano condivise; ogni GPU possiede e rilascia i propri materiali ed effetti.

Riferimenti visivi: [banco di The Last of Us Part II](https://www.shacknews.com/article/118726/how-to-upgrade-weapons-ndash-the-last-of-us-part-2), [menu del banco di Dead Space](https://vulkk.com/2023/02/04/dead-space-weapons-and-rig-upgrades-and-locations-guide/), [scie di calore su Real Time VFX](https://realtimevfx.com/t/heat-distortion-effect-in-unity-hdrp-urp/16039). Interfaccia e shader realizzati nel progetto, senza importare asset dei giochi.

### Organizzazione

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
| `public/assets/models/`        | Tutti i modelli GLB, licenze e catalogo, pubblicati sotto `/assets/models`               |
| `scripts/models/`              | Sorgenti e generatore dei modelli 3D e delle combinazioni                                |
| `src/app/model-library/`       | Catalogo interattivo con anteprima 3D, ricerca e download                                |

`GameService` coordina dominio e interprete; `MiningScene` riceve uno snapshot del mondo. `shared` indicava codice riutilizzabile, ma mescolava elementi diversi: ora ogni elemento vive nella cartella della sua responsabilità. I percorsi dei file 3D sono in `assets/models`, la logica dei modelli in `scene/models`, le forme riutilizzabili in `scene/geometry`.

## Libreria modelli 3D

Apri [il catalogo 3D](http://localhost:4200/?models=1): 65 GLB con anteprima,
rotazione, zoom e download. Include 28 rig e combinazioni, 7 livelli di ventole,
11 GPU, 3 filtri, 3 moduli esterni, banco, ambiente e 8 criptovalute.
Rig, GPU, banco, plot, piazzole, pavimento e Bitcoin della partita sono caricati
dai GLB. I generatori Three.js sono usati solo per esportare gli asset.
Le piazzole sono dimensionate per l'intera famiglia di rig, compresi i moduli
laterali. Le monete BTC, LTC, DOGE, XMR, ETC, KAS, RVN ed ERG condividono le
dimensioni del Bitcoin; il sistema economico della partita continua a usare BTC.

File e documentazione in [`public/assets/models/`](public/assets/models/README.md).
Rigenera i GLB con `npm run models:generate`. Riferimenti online, attribuzioni,
formato e punti di montaggio sono documentati nel README della libreria.

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
- `parallel { gpuUno.mine(); gpuDue.mine(); }`: lancia insieme i comandi semplici nel blocco e aspetta che siano tutti terminati. Dichiara prima le variabili; usa una sola volta ogni GPU.
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

Accedi a una GPU tramite `plots[plotIndex].rig(rigIndex).gpu(gpuIndex)` oppure indicizza il vettore `gpus`. Gli indici partono da zero. GPU è utilizzabile solo se è sbloccato anche il rig. Non esistono ancora metodi per sbloccare l'hardware.

| Attributo                 | Getter MineScript              | Significato                                 |
| ------------------------- | ------------------------------ | ------------------------------------------- |
| `model`                   | `getModel()`                   | Modello configurato                         |
| `frequencyGhz`            | `getFrequencyGhz()`            | Frequenza attuale in GHz                    |
| `powerWatts`              | `getPowerWatts()`              | Consumo attuale in W                        |
| `temperatureCelsius`      | `getTemperatureCelsius()`      | Temperatura attuale in °C                   |
| `fanSpeed`                | `getFanSpeed()`                | Velocità ventole in percentuale             |
| `currentFanSpeedRpm`      | `getCurrentFanSpeedRpm()`      | Velocità attuale ventole in RPM             |
| `maxFrequencyGhz`         | `getMaxFrequencyGhz()`         | Frequenza massima configurata               |
| `maxFanSpeedRpm`          | `getMaxFanSpeedRpm()`          | Velocità massima configurata                |
| `maxTemperatureCelsius`   | `getMaxTemperatureCelsius()`   | Temperatura massima configurata             |
| `minFrequencyGhz`         | `getMinFrequencyGhz()`         | Frequenza minima del modello, 0,5 GHz       |
| `absoluteMaxFrequencyGhz` | `getAbsoluteMaxFrequencyGhz()` | Limite assoluto incluso, 2,6 GHz            |
| `targetFrequencyGhz`      | `getTargetFrequencyGhz()`      | Frequenza impostata per il mining           |
| `wearPercent`             | `getWearPercent()`             | Usura da 0 (nuova) a 100 (esaurita)         |
| `stopped`                 | `isStopped()`                  | Booleano: stop manuale o automatico attivo  |
| `stopReason`              | `getStopReason()`              | Motivo dello stop, stringa vuota se assente |

GPU espone anche `id`, `rigId`, `plotId`, `unlocked`, `working` e `selected`, oltre a `type` che vale `GPU`. I metodi `isWorking()` e `isSelected()` corrispondono agli attributi `working` e `selected`. `working` indica che GPU e rig sono sbloccati, la scheda non è in stop e l'usura è inferiore al 100%; non indica un mining in corso. `selected` indica la GPU selezionata con un clic, indipendentemente dalla posizione sul banco. Tutti i getter richiedono zero argomenti e leggono lo stato corrente anche se l'oggetto script è stato ottenuto prima di una modifica.

La telemetria è indipendente per ogni GPU: i valori di riposo e mining sono in `gpu.idle` e `gpu.mining`. Frequenza e potenza passano al profilo di riposo dopo il lavoro; calore e ventole scendono gradualmente. Il raffreddamento completo richiede 5 secondi di inattività. Le schede in stop mostrano 0 W e 0 GHz; le ventole restano disponibili per il raffreddamento. L'usura non diminuisce.

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

### Overclock, usura e stop GPU

| Metodo                     | Input e risultato                        | Vincoli ed effetti                                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gpu.setFrequencyGhz(ghz)` | Numero finito in GHz; restituisce `null` | Minimo 0,5 GHz. Un valore inferiore o non numerico genera un errore senza modifiche. Nominale massimo 2 GHz, assoluto 2,6 GHz incluso. Un tentativo oltre 2,6 attiva lo stop, conservando l'ultima frequenza valida. |
| `gpu.setFanSpeed(percent)` | Numero da 0 a 100; restituisce `null`    | Imposta ventole manualmente. La velocità cambia consumi e raffreddamento. Il valore resta attivo sulla GPU finché viene sostituito o rimesso in automatico.                                                          |
| `gpu.setFanSpeedAuto()`    | Nessun argomento; `null`                 | Ripristina il controllo automatico delle ventole.                                                                                                                                                                    |
| `gpu.stop()`               | Nessun argomento; `null`                 | Ferma la GPU; ripetibile. Lo stop sopravvive ai successivi avvii del programma.                                                                                                                                      |
| `gpu.clearStop()`          | Nessun argomento; `null`                 | Annulla lo stop senza avviare il mining. Fallisce con temperatura >= 90 °C o usura al 100%. Ripetibile su una scheda sana.                                                                                           |

I comandi richiedono scheda e rig sbloccati. Imposta la frequenza tra due azioni di mining, anche su una scheda ferma. La frequenza impostata resta memorizzata a riposo; `getFrequencyGhz()` restituisce quella effettiva, `getTargetFrequencyGhz()` quella richiesta. Impostare una frequenza valida non annulla uno stop esistente.

Il progresso per azione cresce linearmente con `GHz / 1,8`. La potenza sotto carico e l'aumento termico di equilibrio crescono con il quadrato di quel rapporto. La temperatura si avvicina all'equilibrio con il lavoro e aumenta le ventole. A 90 °C o usura 100%, scatta uno stop automatico: l'azione che causa il guasto viene conteggiata nei consumi e nell'usura, ma non produce progresso. Dopo uno stop termico, riduci i GHz, attendi il raffreddamento e chiama `clearStop()`. Un limite di frequenza accettato non garantisce stabilità termica.

L'usura parte da zero e cresce di base di 0,005 punti percentuali per ora simulata, moltiplicati per il quadrato del rapporto di frequenza, per lo stress termico e per lo sporco oltre soglia. Non si azzera con stop, raffreddamento o nuovo script. Al 100% la GPU richiede sostituzione di pasta e pad al banco e successiva riabilitazione. `gpu.getDustPercent()` (attributo `dustPercent`) espone lo sporco da 0 a 100 per programmare gli interventi.

```js
let gpu = plots[0].rig(0).gpu(0);
gpu.setFrequencyGhz(gpu.getMaxFrequencyGhz());
gpu.mine();
print(gpu.getWearPercent());
gpu.stop();
print(gpu.isStopped()); // true
print(gpu.getStopReason());
gpu.setFrequencyGhz(1.8);
wait(5000);
gpu.clearStop();
gpu.mine();
```

MineScript è sequenziale: `mine()` attende il completamento prima di eseguire la riga dopo. Velocità e modalità automatica delle ventole, come stop e riabilitazione, si impostano solo con MineScript. Il pannello **Corrente e GPU** mostra consumi della farm e specifiche della GPU selezionata nel rig: modello, rig e plot, frequenze, potenza, temperatura, ventole, usura e limiti del modello; la velocità letta lì è solo telemetria. Senza selezione invita a scegliere una scheda; non passa automaticamente alla GPU che sta minando. Il pulsante Stop dell'editor annulla soltanto il programma: l'azione interrotta non assegna progresso o premio, ma conserva energia e usura della frazione lavorata.

### Corrente e portafoglio

Il cambio iniziale è **1 BTC = 60.000 €**, statico e configurabile. Il portafoglio mostra il saldo netto a otto decimali BTC e in euro. La tariffa iniziale è **0,30 €/kWh**. Un `mine()` completo rappresenta **un'ora simulata**, indipendentemente dalla velocità 1×/2×; un'interruzione ne conta la frazione trascorsa. Il tempo economico avanza durante le azioni di mining: pause, attese e inattività non aggiungono consumi.

Il consumo include la GPU attiva e lo standby delle altre GPU sbloccate e operative. Le schede fermate non consumano. L'oggetto globale `electricity` espone questi getter senza argomenti (risultato numerico) e gli attributi equivalenti di sola lettura:

| Metodo                            | Attributo        | Unità e significato                                                   |
| --------------------------------- | ---------------- | --------------------------------------------------------------------- |
| `electricity.getPowerWatts()`     | `powerWatts`     | W istantanei dell'intera farm, incluso standby                        |
| `electricity.getEnergyKwh()`      | `energyKwh`      | kWh complessivi della partita, incluso lavoro già pagato o interrotto |
| `electricity.getPendingCostEur()` | `pendingCostEur` | Euro da pagare al completamento del blocco                            |
| `electricity.getTotalCostEur()`   | `totalCostEur`   | Euro pagati più costo pendente                                        |
| `electricity.getPricePerKwh()`    | `pricePerKwh`    | Tariffa fissa in €/kWh                                                |

`kWh = W / 1000 × ore simulate`. Alla frequenza di base, una sola GPU consuma 0,205 kWh per azione (0,0615 €). I consumi restano pendenti anche tra script diversi o dopo un errore. A blocco completato il premio lordo viene accreditato e la bolletta viene convertita in BTC al cambio fisso, arrotondata una sola volta al satoshi più vicino e sottratta al saldo. Il saldo può diventare negativo se la bolletta supera saldo e premio: il debito resta visibile. Un blocco viene pagato una sola volta e azzera solo il consumo pendente.

Il riepilogo anima prima il premio, poi l'addebito della corrente e il netto. L'animazione osserva il saldo già aggiornato: annullarla o iniziare un nuovo blocco non modifica i conti. Rispetta `prefers-reduced-motion`. Riferimento per il feedback visivo di acquisti e ricompense: [Game UI design](https://www.gamedeveloper.com/design/game-ui-design).

```js
print(electricity.getPricePerKwh());
let gpu = plots[0].rig(0).gpu(0);
gpu.mine();
print(electricity.getPowerWatts());
print(electricity.getEnergyKwh());
print(electricity.getPendingCostEur());
```

`gpu-operation.ts` contiene regole pure di frequenza, temperatura, usura e stop; `electricity.ts` contiene conversione monetaria e tipi dei contatori. `mining-world.ts` applica azioni e saldi immutabili. `GameService` coordina azioni interrompibili e letture live. Wallet e pannello corrente si occupano soltanto di presentazione. Stato, consumi e stop restano in memoria fino a ricaricamento o nuova partita.

L'interprete analizza il programma prima di eseguirlo. Non usa `eval`, `Function` né accesso alle API del browser. I limiti sono in `scripting` e `editor.maxLogEntries`. Gli errori riportano la riga. Un errore di runtime conserva le azioni già completate. Stop annulla anche il mining pendente senza attribuire ricompense.

## Interazione e limiti del prototipo

- Trascina per ruotare, rotella per zoomare. Un clic sulla GPU nella scena o sul pulsante HUD aggiorna selezione e specifiche senza spostare scheda o camera; un doppio clic la porta al banco. Il ritorno la rimonta nel rig mantenendo la selezione. Camera e GPU si muovono insieme, rispettando la preferenza di movimento ridotto del browser.
- Passa il cursore sul modello 3D della GPU per leggere temperatura, usura e consumo aggiornati. Il tooltip si chiude uscendo dalla scheda o con Esc; i pulsanti HUD non lo aprono. Da tastiera, Invio/Spazio selezionano la GPU e ne mostrano le specifiche nel pannello «Corrente e GPU»; Alt+Invio la porta al banco. Cambiare rig, plot o partita azzera la selezione.
- Tooltip e pannello corrente usano superfici opache, separatori sottili e un'apertura di 150 ms con dissolvenza e breve scorrimento, disattivata con `prefers-reduced-motion`. Riferimenti: [tooltip Carbon](https://carbondesignsystem.com/components/tooltip/style/) e [movimento Carbon](https://carbondesignsystem.com/elements/motion/overview/).
- All'avvio è mostrato il primo rig con GPU 1; gli altri rig restano bloccati e sono rappresentati dai quadrati a terra. Non esiste ancora un metodo per sbloccare rig o GPU. Completare blocchi non aggiunge hardware. Il banco resta un singolo arredo sulla destra. La GPU esaminata è distinta dal blocco attivo del programma.
- Ctrl/Cmd + Invio esegue; Tab aggiunge due spazi; Esc poi Tab permette di uscire dall'editor. Durante il run, codice e selezione sono bloccati.
- Il codice viene salvato in `localStorage` se disponibile; la partita resta in memoria. Ricaricando la pagina si riparte dal primo blocco. **Nuova partita** mantiene il codice.
- Nessun backend, account, mining reale o economia di acquisto.
- Serve WebGL2 per la scena. Se non disponibile, il gioco rimane utilizzabile tramite i controlli testuali. Font, modelli e dipendenze sono serviti localmente.

## Crediti

This work is based on [“Low Poly Bitcoin”](https://sketchfab.com/3d-models/low-poly-bitcoin-ec0b85df2dde42eda90b571c12a7cd47) by [Gohar.Munir](https://sketchfab.com/Gohar.Munir), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Convertito in GLB e normalizzato. Sorgenti in `scripts/models/source/bitcoin/`, modello e attribuzione in `public/assets/models/coins/`.

Font DM Sans e IBM Plex Mono distribuiti tramite i rispettivi pacchetti Fontsource, con licenze incluse. Geometrie dei blocchi e icone del progetto create in codice.

Il banco da elettronico è un modello originale costruito in Three.js: piano in legno, telaio metallico, cassetti, tappetino antistatico, oscilloscopio, saldatore, lampada e pannello porta attrezzi. Riferimenti consultati per tipologia e stile: [Workbench low-poly di MaX3Dd](https://sketchfab.com/3d-models/workbench-low-poly-01c0b5991ad448ed917845df202867c2) e [Workbench su Free3D](https://free3d.com/3d-model/workbench-6290.html). Nessuna geometria o texture di questi modelli è inclusa nel progetto.

Riferimenti: [compatibilità Angular](https://angular.dev/reference/versions), [documentazione Three.js](https://threejs.org/docs/).

Rig e GPU sono modelli originali esportati in GLB e caricati direttamente nel gioco. Riferimenti hardware e fonti ufficiali sulle criptovalute sono raccolti nel [README degli asset](public/assets/models/README.md) e nel catalogo JSON.

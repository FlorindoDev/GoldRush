# Blockcraft

Prototipo di gioco Angular + Three.js: scrivi MineScript per azionare una GPU su una mappa 3D low poly. Mining e BTC sono simulati.

## Avvio

Richiede Node.js 24.15+ (24.x) e npm.

```sh
npm install
npm start
```

Apri **http://localhost:4200**. Premi **Inizia a minare**, poi **Esegui codice**. Cinque `mine()` completano il blocco e assegnano 0.0100 BTC. Sblocca il successivo con il pulsante sulla mappa. Il prototipo termina dopo quattro blocchi, ognuno con una GPU.

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

Per orientarti nella scena, parti da `scene.component.ts` (collegamento con Angular), poi `mining-scene.ts` (rendering e interazione), `block-mesh.ts` (GPU, bitcoin ed effetti) ed `electronics-workbench.ts` (banco da elettronico e strumenti low poly). Le primitive condivise sono in `mesh-primitives.ts`. I costruttori delegano a metodi con nomi espliciti; gli esempi MineScript si trovano in `language/examples.ts`.

## Moduli

Componenti Angular standalone organizzati per funzionalità; nessun NgModule necessario.

| Directory          | Responsabilità                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `src/app/game`     | Stato reattivo, regole pure della partita, selezione, saldo in satoshi, esecuzione e log |
| `src/app/language` | Lexer, parser, AST e interprete asincrono indipendenti da Angular e Three.js             |
| `src/app/scene`    | Rendering Three.js, blocchi, modello GPU, camera, selezione e gestione risorse           |
| `src/app/editor`   | Editing, evidenziazione, numeri di riga, esempi e scorciatoie                            |
| `src/app/console`  | Output del programma ed errori                                                           |
| `src/app/shared`   | Icone condivise                                                                          |

`GameService` coordina il dominio e l'interprete; `MiningScene` riceve solo uno snapshot del mondo e richiama la selezione. La logica delle ricompense rimane nelle funzioni pure di `mining-world.ts`.

## MineScript

```js
// Completa il blocco selezionato, anche se già parzialmente estratto.
while (progress() < 100) {
  mine();
  print('Progresso: ' + progress() + '%');
}
```

- `mine()`: +20% sul blocco selezionato, animazione di 850 ms (425 ms a velocità 2×). Il premio viene assegnato solo al raggiungimento del 100%; un blocco completato non si può minare di nuovo.
- `progress()`: progresso attuale, 0–100.
- `print(valore)`: scrive in console.
- `wait(ms)`: pausa interrompibile, 0–5000 ms. La velocità 2× riguarda solo `mine()`.
- `repeat(n) { ... }`: intero 0–1000.
- `for (let i = 0; i < 5; i++) { ... }`, `while (...) { ... }`, `if (...) { ... } else { ... }`.
- Variabili `let`, assegnazione, `++`, `--`, numeri, stringhe, booleani, `+ - * / %`, confronti `== != < <= > >=`, `&& || !` e parentesi.
- Commenti `//`; punto e virgola obbligatorio per istruzioni semplici. Variabili in un unico ambito per esecuzione; vengono azzerate al run successivo. Le dichiarazioni dentro i cicli possono riassegnarle.

L'interprete analizza il programma prima di eseguirlo. Non usa `eval`, `Function` né accesso alle API del browser. Limiti: 20.000 caratteri, 64 livelli di parser, 10.000 operazioni per esecuzione, ultimi 100 log, messaggi di massimo 2.000 caratteri. Gli errori riportano la riga. Un errore di runtime conserva le azioni già completate. Stop annulla anche il mining pendente senza attribuire ricompense.

## Interazione e limiti del prototipo

- Trascina per ruotare, rotella o pulsanti per zoomare; selezione con clic sulla scena o schede accessibili. Camera ricentrabile.
- Ctrl/Cmd + Invio esegue; Tab aggiunge due spazi; Esc poi Tab permette di uscire dall'editor. Durante il run, codice e selezione sono bloccati.
- Il codice viene salvato in `localStorage` se disponibile; la partita resta in memoria. Ricaricando la pagina si riparte dal primo blocco. **Nuova partita** mantiene il codice.
- Nessun backend, account, mining reale, economia di acquisto o GPU aggiuntive sullo stesso blocco.
- Serve WebGL2 per la scena. Se non disponibile, il gioco rimane utilizzabile tramite i controlli testuali. Font, modelli e dipendenze sono serviti localmente.

## Crediti

This work is based on [“GPU Low Poly”](https://sketchfab.com/3d-models/gpu-low-poly-934115a6f28440668b5ff70aa5a88b1d) by [N1shor](https://sketchfab.com/N1shor), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modifiche in scena: scala, orientamento e colore. File originali e licenza in `modelli/modello-gpu/`.

This work is based on [“Low Poly Bitcoin”](https://sketchfab.com/3d-models/low-poly-bitcoin-ec0b85df2dde42eda90b571c12a7cd47) by [Gohar.Munir](https://sketchfab.com/Gohar.Munir), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modifiche in scena: scala e orientamento. File originali e licenza in `modelli/bitcoin/`.

Font DM Sans e IBM Plex Mono distribuiti tramite i rispettivi pacchetti Fontsource, con licenze incluse. Geometrie dei blocchi e icone del progetto create in codice.

Il banco da elettronico è un modello originale costruito in Three.js: piano in legno, telaio metallico, cassetti, tappetino antistatico, oscilloscopio, saldatore, lampada e pannello porta attrezzi. Riferimenti consultati per tipologia e stile: [Workbench low-poly di MaX3Dd](https://sketchfab.com/3d-models/workbench-low-poly-01c0b5991ad448ed917845df202867c2) e [Workbench su Free3D](https://free3d.com/3d-model/workbench-6290.html). Nessuna geometria o texture di questi modelli è inclusa nel progetto.

Riferimenti: [compatibilità Angular](https://angular.dev/reference/versions), [documentazione Three.js](https://threejs.org/docs/).

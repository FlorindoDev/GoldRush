# Libreria GLB GoldRush

65 modelli nel [catalogo JSON](catalog.json). Anteprima: `http://localhost:4200/?models=1`.
Per aprire un modello direttamente: `?models=1&model=rig-8-mesh-liquid`.

| Cartella       | Contenuto                                                                               | Modelli |
| -------------- | --------------------------------------------------------------------------------------- | ------: |
| `rigs/`        | 12 combinazioni da 8 GPU, 3 telai modulari e 13 rig vuoti per la partita                 |      28 |
| `fans/`        | Flow, Pressure, Forge, Cyclone, Prism, Counter, Server Jet                              |       7 |
| `gpus/`        | Compact, Dual, Triple, Blower, Passive, Hydro, Atelier, Neon, Workstation, Slim, Hybrid |      11 |
| `filters/`     | Rete, cartuccia pieghettata, doppio strato                                              |       3 |
| `cooling/`     | Supporto universale, Air Wall, Hydro Tower                                              |       3 |
| `workshop/`    | Banco da elettronico con attrezzi                                                       |       1 |
| `environment/` | Area officina, plot, slot universale, pavimento                                         |       4 |
| `coins/`       | BTC, LTC, DOGE, XMR, ETC, KAS, RVN, ERG                                                 |       8 |

## Uso nel gioco

La scena carica i GLB tramite `SceneAssets`: rig, banco, pavimento, plot e
piazzole. La GPU principale usa `gpus/gpu-dual.glb`; la variante compatta GLB
viene precaricata per mantenerla utilizzabile se il caricamento principale fallisce.
Portafoglio e pila sul banco caricano `coins/bitcoin.glb`.

Nessuna cartella o categoria legacy. I generatori geometrici dell'hardware e
dell'arredamento sono sotto `scripts/models/` e non entrano nel bundle del gioco.
Selezioni, etichette numerate, particelle, illuminazione ed effetti termici restano
dinamici. Geometrie e texture GLB sono condivise, materiali modificabili isolati
per istanza e risorse rilasciate con il proprietario.

Il rig di partenza conserva i quattro slot della configurazione di gameplay,
con lo stesso telaio, materiali, viti, elettronica e ventole dei rig da otto GPU.
`GAME_BALANCE.models.startingRigId` sceglie fra `rig-gameplay` e le 12 varianti
`rig-gameplay-{none|mesh|pleated|carbon}-{none|air|liquid}`. Sono tutte vuote:
le GPU sbloccate vengono montate dal gioco. `startingGpuId` sceglie il GLB delle
GPU della partita; `fallbackGpuId` sceglie il GLB di riserva. Cambiare questi ID
richiede solo riavviare la build. `startingRigFanId` e `world.gpusPerRig` modificano
la geometria esportata: dopo la modifica eseguire `npm run models:generate`.
I colori di plot, slot e officina sono in `GAME_BALANCE.scene.surfaces`:
anche queste modifiche richiedono `npm run models:generate`.
I bordi tratteggiati sono geometria GLB, quindi rimangono visibili nel gioco.

## Slot universali

Ogni slot misura 10 × 5.4 unità, con passi di 11.2 × 6.6.
Il plot misura 23.6 × 20.4, con due colonne e tre righe.
`fitRigInSlot()` centra l'intero ingombro, compresi radiatore, pompa, tubi e
supporti laterali. I modelli attuali entrano a scala naturale; un modello futuro
più grande viene ridotto uniformemente, conservando le proporzioni.
L'officina si sposta oltre il bordo destro dei plot per mantenere il passaggio.

Ogni rig contiene `gpu-slot-01` … `gpu-slot-08` (quattro nel rig della partita),
`fan-mount-1` … `fan-mount-5`, `filter-mount` e `cooling-mount`.
Rotori e cavi sono nodi separati. Nei telai vuoti i cavi vengono nascosti dal
viewer; in partita la visibilità segue le GPU installate.
Le GPU Hydro espongono `coolant-in` e `coolant-out`.

## Ventole

| Modello        | Livello |  RPM | CFM |   W |
| -------------- | ------: | ---: | --: | --: |
| Flow 120       |       1 | 1500 |  58 | 2.4 |
| Pressure 140   |       2 | 2200 |  92 | 4.8 |
| Forge 140      |       3 | 3200 | 135 | 9.6 |
| Cyclone 200    |       4 | 4200 | 210 |  18 |
| Prism 200      |       5 | 4600 | 245 |  23 |
| Counter 200    |       6 | 5200 | 300 |  34 |
| Server Jet 240 |       7 | 6500 | 390 |  48 |

Progressione fittizia di gioco. Prism aggiunge anelli colorati; Counter ha due
rotori contrapposti; Server Jet ha una struttura canalizzata rinforzata.
Il kit silenzioso è rimosso anche dal banco: disponibili Originale, Alta portata,
Industriale e Server Jet. Parametri della manutenzione in `game-balance.ts`.

## Criptovalute

Tutte le monete hanno gli stessi ingombri del Bitcoin normalizzato:
0.9 × 0.9 × circa 0.079 unità, con simbolo su entrambe le facce.
Ticker, algoritmo e fonte del progetto sono nel catalogo.
Le nuove monete sono asset utilizzabili nel gioco; l'economia corrente resta in BTC.

| Moneta           | Algoritmo  | Riferimento                                                         |
| ---------------- | ---------- | ------------------------------------------------------------------- |
| Bitcoin          | SHA-256    | [Bitcoin](https://bitcoin.org/en/how-it-works)                      |
| Litecoin         | Scrypt     | [Litecoin](https://litecoin.info/docs/key-concepts/proof-of-work)   |
| Dogecoin         | Scrypt     | [Dogecoin](https://dogecoin.com/dogepedia/how-tos/mining-dogecoin/) |
| Monero           | RandomX    | [Monero](https://www.getmonero.org/get-started/mining/)             |
| Ethereum Classic | Etchash    | [Ethereum Classic](https://www.ethereumclassic.org/faqs/miners/)    |
| Kaspa            | kHeavyHash | [Kaspa](https://kaspa.org/)                                         |
| Ravencoin        | KAWPOW     | [Ravencoin](https://ravencoin.org/about/)                           |
| Ergo             | Autolykos  | [Ergo](https://learn.ergoplatform.com/mining/)                      |

## Rigenerazione e formato

`npm run models:generate` dalla radice, con dipendenze di sviluppo e Microsoft
Edge installati. `MODEL_BROWSER` permette di usare un altro canale Playwright.
La build ordinaria usa i file già esportati e non richiede il generatore.
Sorgenti modificabili in `scripts/models/`; sorgente Bitcoin in
`scripts/models/source/bitcoin/`.

GLB glTF 2.0 autonomi con materiali PBR. Asse verticale Y; unità di gioco.
GPU singole orizzontali, ventole e monete nel piano XY.
`extras.animationAxis` identifica l'asse dei rotori;
`extras.animationDirection` gestisce la controrotazione.

## Riferimenti e licenze

Modelli hardware originali ispirati ai riferimenti seguenti, senza importare le
loro geometrie, texture o marchi:

- [NVIDIA RTX PRO](https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-6000-family/): schede professionali.
- [ASUS ProArt](https://www.asus.com/us/motherboards-components/graphics-cards/proart/proart-rtx5080-o16g/): carenatura compatta e inserti caldi.
- [Sapphire NITRO+](https://www.sapphiretech.com/en/consumer/nitro-radeon-rx-9070-xt-16g-gddr6): copertura metallica e dettagli luminosi.
- [Phanteks T30](https://phanteks.com/product/t30-120/): ventole spesse ad alta pressione.
- [Noctua NF-A12x25](https://www.noctua.at/en/products/nf-a12x25-pwm): pale curve e supporti.
- [DEMCiflex](https://www.demcifilter.com/How-to-choose): filtri magnetici.
- [Watercool MO-RA IV](https://shop.watercool.de/MO-RA-IV-200-Black_1): radiatore esterno.
- [Veddha Minercase V4](https://www.ricardo.ch/de/a/mining-rig-frame-veddha-minercase-v4-8-bay-1246445272/): telaio aperto da otto GPU.

Bitcoin deriva da [“Low Poly Bitcoin”](https://sketchfab.com/3d-models/low-poly-bitcoin-ec0b85df2dde42eda90b571c12a7cd47)
di [Gohar.Munir](https://sketchfab.com/Gohar.Munir), licenza
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Modifiche: normalizzazione della scala, centratura e conversione GLB.
[Attribuzione completa](coins/bitcoin-license.txt). Le altre monete sono geometrie
originali con simboli stilizzati dei rispettivi progetti.

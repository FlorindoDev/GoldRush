# Bilanciamento della farm

La partita inizia con un RIG, una GPU passiva e DOGE. Nessun capitale gratuito.
Il ciclo è: completare blocchi, coprire la corrente, scegliere tra ricerca e hardware,
installare i pezzi e adattare lo script a temperatura, difficoltà e tariffa.
Prezzi e prestazioni sono simulati, non dati di mercato.

## Obiettivi verificati

- Primo blocco con hardware iniziale: 90–180 secondi a velocità 1×.
- Una seconda GPU passiva acquistabile entro cinque blocchi, corrente compresa,
  pulendo la scheda tra i blocchi.
- Solo DOGE disponibile all'inizio. Percorso: DOGE → RVN → ERG → ETC → XMR → LTC → KAS → BTC.
- Ogni nuova crypto offre più premio per unità di lavoro iniziale, ma richiede un blocco
  più lungo, la ricerca precedente, fondi e un numero minimo di blocchi completati.
- La difficoltà cresce separatamente per catena e smette di crescere al suo massimo.
- A difficoltà alta una GPU iniziale può perdere soldi a frequenza nominale:
  l'underclock può riportare il margine sopra zero. Le GPU avanzate restano redditizie
  anche ai massimi di difficoltà e tariffa, a temperatura contenuta.

Questi obiettivi sono coperti da `src/app/game/tests/progression-balance.spec.ts`.
I tempi successivi dipendono da ricerca, reinvestimenti, manutenzione e programma:
il limite di difficoltà impedisce una crescita infinita del lavoro richiesto.

## Dove intervenire

| File in `src/app/config`  | Responsabilità                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `crypto-config.ts`        | Ordine delle crypto, prezzi simulati, premio, difficoltà iniziale/incremento/tetto, costo e requisito della ricerca |
| `gpu-config.ts`           | Potenza nominale `miningPower`, frequenze, consumi, calore, usura e polvere                                         |
| `world-config.ts`         | Capacità della farm, hardware iniziale, durata e progresso base dell'azione                                         |
| `economy-config.ts`       | Tariffa iniziale, fasce giornaliere, ore simulate e clock                                                           |
| `shop-config.ts`          | Prezzi dei pezzi, separati dalla ricerca                                                                            |
| `research-tree-config.ts` | Ricerca hardware; ramo crypto generato da `crypto-config.ts`                                                        |

Il progresso base non dipende dal numero massimo di slot della farm: aggiungere
capacità al mondo non rende più lenta la GPU iniziale.

## Formule

```text
difficoltà = min(iniziale + blocchi precedenti × incremento, massimo)
rapporto = frequenza effettiva / frequenza nominale del modello
progresso per azione (%) = progresso base × miningPower × rapporto^esponente / difficoltà
watt = idle + (nominale − idle) × rapporto² + kit ventole + quota moduli RIG
costo azione = watt / 1000 × ore simulate × tariffa
ricavo stimato = progresso / 100 × premio del blocco in euro
margine stimato = ricavo stimato − costo azione
```

Il consumo conserva una parte fissa: scendere alla frequenza minima non garantisce
il miglior margine. L'overclock aumenta il lavoro, ma anche calore e usura; il
throttling può annullare il vantaggio. La polvere rallentata consente di terminare
il primo blocco prima di rendere necessaria la manutenzione.

Ogni azione simula un'ora di lavoro indipendentemente dalla velocità 1×/2×.
Il giorno dura 12 minuti reali: le fasce tariffarie sono calibrate sui consumi
accumulati dalle azioni, non su 24 azioni. Un aumento della tariffa vale solo
dopo aver pagato il giorno precedente. Fermare il programma conserva i costi pendenti.

## MineScript e accrediti

`gpu.estimate()` restituisce una fotografia della stima. `gpu.estimate("RVN", 1.1)`
confronta una valuta e una frequenza senza cambiare stato. La guida interna contiene
tutti i campi, i limiti e un esempio eseguibile di ottimizzazione.

La stima assume temperatura e tariffa costanti, esclude acquisti, manutenzione e
standby delle altre GPU. Il lavoro è pagato solo al completamento del blocco;
il margine stimato non è un accredito parziale. A blocco concluso la stima passa
alla difficoltà successiva. Cambiare assegnazione conserva progressi e difficoltà.

Le catene pagano premi separati, una sola volta. Anche un blocco completato da
azioni parallele viene liquidato prima di avanzare al successivo. `progress()`
legge DOGE; per altre catene usare `progress("RVN")` oppure `gpu.progress`.

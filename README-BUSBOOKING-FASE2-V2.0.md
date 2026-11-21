# BusBooking Web Angular 22 — Fase 2 v2.0 — Mappa delle fermate vicine

## Base della patch

**Applicare direttamente alla versione Fase 1 v1.7.2** (polling dinamico, NON è necessario installare la v1.7.1). Questo archivio è **esclusivamente incrementale**; i percorsi interni partono dalla radice del progetto (`src/`, `package.json`, `angular.json`).

## Comportamento

- Accanto al titolo «Fermate vicine» compare, in alto, il pulsante **Mappa fermate** solo se almeno una delle fermate vicine ricevute dal backend ha coordinate utilizzabili.
- Il pulsante apre una **finestra modale responsive** con mappa interattiva MapLibre GL JS + cartografia OpenFreeMap (stile `liberty`). Nessuna chiave API Google o nuova API di backend.
- La mappa visualizza le fermate già caricate con segnaposti arancioni ed etichetta, la posizione corrente con un punto blu, e adatta automaticamente l'inquadratura.
- Cliccare un segnaposto o selezionare una voce dall'elenco nella modale mostra il dettaglio della fermata; **Visualizza corse** porta alla rotta `/stop` con gli **stessi parametri** dell'elenco principale.
- Durante una ricerca con **Filtra** (`query` REST), il pulsante mappa scompare. Il filtro resta **esclusivamente remoto**. Riportando il filtro a vuoto e ricaricando le fermate vicine, il pulsante riappare.
- La mappa **non invia richieste REST supplementari** a BusBooking. Riutilizza le coordinate GPS e l'elenco già caricati dalla GET `/fermate` senza `query`.
- Un'eventuale fermata priva di coordinate rimane visibile nella lista tradizionale ma non viene collocata sulla mappa. Se il browser non supporta WebGL / la cartografia è indisponibile, la modale consente comunque la scelta dalla lista laterale.
- La libreria MapLibre è **caricata in modo lazy** alla prima apertura della modale; la sua risorsa CSS è configurata in `angular.json`.
- La logica di assistenza corse (timer 30/20 secondi, avvisi acustici) **non è stata modificata**.

## Installazione

1. Estrarre questo ZIP nella directory principale dell'app Angular 22 v1.7.2 (quella che contiene `angular.json`), sovrascrivendo i file indicati.
2. Installare la nuova dipendenza `maplibre-gl` eseguendo **`npm install`** (non basta estrarre i file; è stato aggiornato `package.json`).
3. Eseguire **`npm test`**, **`npm run build`** e **`npm start`**.
4. Aprire la pagina **Fermate vicine**, selezionare **Mappa fermate** e verificare che i marker siano selezionabili, che il pulsante «Visualizza corse» funzioni, e che il filtro remoto non esponga la mappa.

## Test aggiunti

- Presentazione del pulsante in alto alle sole fermate vicine e disabilitazione sui risultati del filtro remoto.
- Ripristino del pulsante dopo l'azzeramento del filtro.
- Esclusione dei record senza coordinate senza rimuoverli dalla lista ordinaria.
- Validazione delle coordinate.
- Navigazione alla schermata delle corse da una fermata selezionata nella modale.
- Fallback della modale quando MapLibre non si inizializza.
- Posizionamento dei marker su `[longitudine, latitudine]`, selezione da marker e cleanup alla chiusura.

## Verifiche effettuate e limiti

- Verificati: struttura del patch ZIP, assenza di file estranei e uso dei vecchi endpoint REST; analisi sintattica TypeScript dei file sorgente; verifica statica del progetto (`npm run verify:static`).
- **Non eseguiti in questa sessione**: compilazione Angular completa, suite Vitest e rendering WebGL in un browser reale. L'ambiente non dispone delle dipendenze npm e non riesce a raggiungere il registry (errore di rete EAI_AGAIN). Il collaudo locale del progetto resta quindi necessario.
- MapLibre/OpenFreeMap richiedono una connessione Internet per caricare lo stile e le tessere cartografiche; **non** richiedono chiavi API.

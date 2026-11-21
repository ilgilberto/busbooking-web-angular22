# BusBooking Web Angular 22 — Fase 2 v2.0.3 — Correzione cartografia vuota

## Base di applicazione
Applicare questo ZIP **sopra la v2.0.2** (con la v2.0.1 gia' installata). Lo ZIP e' esclusivamente incrementale.

## Problema affrontato
I marker arancioni e il punto GPS erano visibili, ma lo sfondo cartografico era vuoto e appariva «Impossibile caricare la cartografia». La v2.0 inizializzava MapLibre GL JS v6 senza indicare esplicitamente l'URL del Web Worker ESM necessario al rendering della cartografia con Angular/esbuild.

## Modifiche
- `angular.json`: copia in output, durante `ng serve` e `ng build`, `maplibre-gl-worker.mjs` e `maplibre-gl-shared.mjs` dalla dipendenza npm verso `assets/maplibre/` (inclusi in entrambe le modalita' dev/prod).
- `src/app/utils/maplibre-loader.token.ts`: configurazione esplicita del worker con `setWorkerUrl()`, URL risolto rispetto a `document.baseURI`, suffisso `?v=<versione>` anti-cache.
- `src/app/components/nearby-stops-map/nearby-stops-map-dialog.component.ts`: imposta il worker **prima** di creare la mappa; aggiunge diagnostica degli errori effettivi in console.
- `src/app/components/nearby-stops-map/nearby-stops-map-dialog.component.spec.ts`: verifica che il worker sia configurato anche quando MapLibre viene caricato in modalita' lazy.
- `src/app/utils/maplibre-loader.token.spec.ts`: 2 nuovi test per URL locale e deploy sotto `/busbooking/`.

## Verifica nel tuo ambiente
```
npm test
npm run build
npm start
```
**Arrestare e riavviare `npm start`** dopo questa modifica: `angular.json` e' cambiato.

Nel browser aprire di nuovo Mappa fermate. Verificare nella scheda Network che il worker venga servito con HTTP 200:
- sviluppo: `http://localhost:4200/assets/maplibre/maplibre-gl-worker.mjs?v=...`
- produzione con base href `/busbooking/`: `/busbooking/assets/maplibre/maplibre-gl-worker.mjs?v=...`

Se compare ancora «Impossibile caricare la cartografia», aprire DevTools → Console e Network: ora un errore MapLibre riporta il motivo (URL/CORS, WebGL, tile, ecc.). Non e' possibile attribuire con certezza il mancato caricamento al solo worker senza vedere il log del browser, ma questa e' una lacuna certa nella configurazione v2.0.

## Invariato
Nessuna modifica a REST, gestione del filtro, lista fermate, marker, navigazione verso le corse o logica di assistenza autobus.

## Stato verifiche
Verificati staticamente i riferimenti ai worker, la configurazione Angular, la struttura dei test e la presenza dei soli file modificati nel pacchetto. Non sono stati eseguiti `npm test` / `npm run build` per indisponibilita' delle dipendenze npm nell'ambiente di generazione.

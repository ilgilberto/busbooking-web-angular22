# BusBooking Web — Angular 22 (Fase 1)

Migrazione tecnica della web app da Angular 13 ad Angular 22, mantenendo i percorsi, le schermate, i servizi REST e l'interfaccia originale. **Le mappe saranno introdotte nella Fase 2.**

## Prerequisiti

- Node.js **24.15.0 o successivo della serie 24.x** (file `.nvmrc`). È supportato anche Node >=22.22.3 o >=26.0.0 secondo la tabella ufficiale Angular 22.
- npm incluso in Node.js.
- Accesso alla rete per scaricare i pacchetti npm.

Attenzione: Node 22.16 o precedenti **non** sono compatibili con Angular 22.

## Installazione (nuovo progetto o dopo la migrazione)

```bash
node --version
npm install
```

La ZIP non contiene `node_modules` e non include il vecchio `package-lock.json` di Angular 13: **il primo `npm install` genera il nuovo lockfile**. Committere poi `package-lock.json` e utilizzare `npm ci` nelle installazioni riproducibili/CI.

## Sviluppo

```bash
npm start
```

Aprire http://localhost:4200/. L'API di sviluppo rimane `/api`, inoltrata dal proxy a `https://mandarini.info/iorestoacasa` come nell'originale. Il proxy usa `/api/**` per includere anche i percorsi annidati nel dev-server basato su Vite.

## Build e test

```bash
npm run verify:static
npm run build:dev
npm test
npm run build
```

Test con Vitest (in sostituzione di Karma/Jasmine); build con `@angular/build:application`.

## Pubblicazione sotto /busbooking/

La configurazione di produzione continua a usare `apiBaseUrl: '/busbooking/api'`. Effettuare la build specificando il path base:

```bash
npm run build -- --base-href /busbooking/
```

I file pubblicabili si trovano in **`dist/bus-booking-web/browser/`** (cambiamento introdotto dal builder Angular moderno). Per il deploy SSH preesistente, dopo aver verificato l'output:

```bash
npm run build:ssh
```

Questo comando prova a caricare realmente i file sul server: **non eseguirlo per i collaudi locali**. Lo script `upload-ssh.js` usa ancora host, utente e password interattiva della versione originale; valutare successivamente l'uso di una chiave SSH e di un utente non privilegiato.

Il server che pubblica l'app Angular deve fare fallback a `/busbooking/index.html` per le rotte `/busbooking/stops` e `/busbooking/stop`, senza intercettare le API `/busbooking/api`.

## Cosa è stato conservato

- Percorsi: `/`, `/stops`, `/stop`.
- Ricerca fermate via geolocalizzazione e calcolo distanza.
- Elenco corse, simboli satellite/tabellone, prenotazione assistenza.
- Polling dell'assistenza ogni 30 secondi, avviso sonoro e conferma arrivo.
- Immagini, audio, logo, testo, stili e integrazioni REST.
- Configurazioni API sviluppo e produzione.

## Modifiche tecniche

- Bootstrap `bootstrapApplication`, componenti `standalone`, `provideRouter`, `provideHttpClient`.
- TypeScript 6, Angular Material 22, build esbuild/Vite, test Vitest.
- Zone.js esplicitamente abilitato per conservare gli aggiornamenti dei timer e della geolocalizzazione. Modernizzazione a zoneless rinviata.
- Tipi TypeScript per fermate, linee e corse; cleanup delle subscription all'arresto/distruzione del booking.
- Corretto il percorso CSS legacy dell'immagine di sfondo (`~src/...`) e quello di deploy SSH (`.../browser`).

## Stato di verifica della consegna

La struttura è stata controllata staticamente anche tramite `npm run verify:static` (eseguito con esito OK). **Non è stato possibile eseguire `npm install`, `ng build` o Vitest** nell'ambiente in cui è stata preparata la ZIP, perché non è raggiungibile il registry npm e la versione locale di Node è 22.16.0 (inferiore al minimo di Angular 22). La validazione del build e l'esecuzione dei test rimangono da effettuare sulla tua macchina con Node compatibile.

Se durante la prima build o i test compare un errore, condividere il log completo prima di mettere in produzione.

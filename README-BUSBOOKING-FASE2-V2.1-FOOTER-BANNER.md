# BusBooking Web — Fase 2 v2.1 — Footer dinamico Conoscenza Creativa

Patch **incrementale**, da applicare sopra **v2.0.7**. Non include l'intera applicazione e non richiede nuove dipendenze npm.

## Comportamento

- Footer unico nel componente root: presente su tutte le route (`/`, `/stops`, `/stop`), fissato in basso nel viewport. Lo spazio in fondo alle pagine è riservato solo quando il banner è disponibile, per non sovrapporre pulsanti o contenuti.
- Caricamento immagini remoto, in sequenza: `imm0.jpg`, `imm1.jpg`, `imm2.jpg`, ...; la ricerca si ferma al **primo file mancante/non caricabile**. Niente `HEAD` né requisiti CORS: il controllo usa le normali immagini del browser.
- Se `imm0.jpg` non si carica, **nessun footer** viene mostrato e non viene riservato spazio.
- Non appena `imm0.jpg` è caricata, il footer viene mostrato e il banner scorre **da sinistra a destra**. Le immagini successive si agganciano senza separatori alla sua sinistra e scorrono insieme. Finita la scansione, dopo che **tutte** le immagini sono uscite completamente a destra e il footer è tornato vuoto, la sequenza riparte da `imm0`.
- Ogni immagine mantiene le proporzioni originali; altezza responsive tra 34 e 48 pixel. Un leggero bordo separa la fascia dal resto della pagina.
- L'intera striscia è cliccabile e apre la destinazione in **nuova scheda** (`target="_blank"`, `rel="noopener noreferrer"`). Su desktop lo scorrimento si ferma quando il puntatore è sopra o quando il link ha focus da tastiera.
- Rispetta `prefers-reduced-motion`: in questo caso presenta il solo primo banner, fermo e cliccabile.
- Per sicurezza il rilevamento è limitato a 100 immagini: impedisce carichi illimitati se il server risponde con un'immagine valida per qualsiasi nome. In uno scenario normale si interrompe prima, al primo file mancante.
- La scansione avviene una volta all'avvio della pagina: i cicli successivi riutilizzano le immagini già caricate, evitando nuove richieste HTTP continue. Un refresh recupera eventuali banner nuovi.

## Configurazione

In **entrambi** `src/environments/environment.ts` (sviluppo) e `environment.prod.ts` (produzione) sono stati aggiunti:

```typescript
footerBannerImageUrlPrefix: 'https://conoscenzacreativa.it/banner/imm',
footerBannerDestinationUrl: 'https://conoscenzacreativa.it/mondodilibri',
footerBannerSpeedPxPerSecond: 42
```

Il nome dei file generati è `${footerBannerImageUrlPrefix}${i}.jpg` a partire da `i = 0`.

Le modifiche agli `environment` richiedono **ricompilazione e ridistribuzione**; non sono parametri caricati dinamicamente a runtime.

## File nel patch

- `src/app/app.component.ts`
- `src/app/app.component.html`
- `src/app/app.component.scss`
- `src/app/app.component.spec.ts`
- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`
- `src/app/components/banner-footer/banner-footer.component.ts` (nuovo)
- `src/app/components/banner-footer/banner-footer.component.html` (nuovo)
- `src/app/components/banner-footer/banner-footer.component.scss` (nuovo)
- `src/app/components/banner-footer/banner-footer.component.spec.ts` (nuovo)
- `src/app/utils/footer-banner-loader.token.ts` (nuovo)
- `src/app/utils/footer-banner-motion.util.ts` (nuovo)
- `src/app/utils/footer-banner-motion.util.spec.ts` (nuovo)

Nessuna modifica alle mappe, agli endpoint REST o alla logica di assistenza corse.

## Verifiche

```bash
npm test
npm run build
npm start
```

Test da effettuare nel browser: footer con imm0 disponibile, sparizione del footer se imm0 non esiste, aggancio imm1/imm2, nessuna sovrapposizione su mobile, link in nuova scheda, reset dopo l'uscita di tutti i banner e popup MapLibre davanti al footer.

**Limite dell'ambiente di preparazione:** verifica statica del progetto e parsing TypeScript eseguiti; non è stato possibile eseguire `npm install`, `npm run build` e Vitest in assenza delle dipendenze npm e di accesso al registry.

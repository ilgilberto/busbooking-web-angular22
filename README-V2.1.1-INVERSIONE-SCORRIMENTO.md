# BusBooking Web Angular 22 — Fase 2 v2.1.1

## Patch incrementale: banner da destra a sinistra

**Base richiesta:** v2.1 (footer animato), già applicata. **Non** è un progetto completo.

### Cambiamento

Il convoglio delle immagini `imm0.jpg`, `imm1.jpg`, ... entra dal **margine destro**
e scorre verso **sinistra** alla velocità già configurata tramite
`footerBannerSpeedPxPerSecond`. `imm1` segue `imm0`, senza separazione, e così
via. Quando tutte le immagini sono fuori dal bordo sinistro, segue un tratto
vuoto prima di ricominciare da `imm0`.

Non vengono modificati l'altezza, le proporzioni responsive, la destinazione
al click, la configurazione degli URL o la scoperta delle immagini.

### File modificati

- `src/app/components/banner-footer/banner-footer.component.ts`
- `src/app/components/banner-footer/banner-footer.component.scss`
- `src/app/components/banner-footer/banner-footer.component.spec.ts`
- `src/app/utils/footer-banner-motion.util.ts`
- `src/app/utils/footer-banner-motion.util.spec.ts`

Estrarre lo ZIP nella **radice** del progetto Angular 22, sovrascrivendo i cinque
file. Nessuna nuova dipendenza.

```bash
npm test
npm run build
```

### Verifiche

Verificati tramite test di logica isolato (Node): velocità negativa, ordine
di ingresso e soglia di riavvio con strip di larghezza variabile. **La suite
Angular/Vitest completa e la build non sono state eseguite** in questo ambiente.

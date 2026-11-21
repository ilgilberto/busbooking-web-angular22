export const environment = {
  production: true,
  apiBaseUrl: '/busbooking/api',
  /** Polling satellitare con tempo all'arrivo superiore a 2 minuti. */
  bookingPollingIntervalFarMs: 30_000,
  /** Polling satellitare con tempo all'arrivo inferiore o uguale a 2 minuti. */
  bookingPollingIntervalNearMs: 20_000,
  /** Scostamento ETA oltre il quale aggiornare la stima e segnalare acusticamente. */
  bookingEtaChangeThresholdMs: 60_000,
  /** Prefisso delle immagini: imm0.jpg, imm1.jpg, ... fino al primo file assente. */
  footerBannerImageUrlPrefix: 'https://conoscenzacreativa.it/banner/imm',
  /** Destinazione cliccabile dei banner: apertura in una nuova scheda. */
  footerBannerDestinationUrl: 'https://conoscenzacreativa.it/mondodilibri',
  /** Velocità di scorrimento dei banner verso destra, in pixel al secondo. */
  footerBannerSpeedPxPerSecond: 42
};

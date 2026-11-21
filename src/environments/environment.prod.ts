export const environment = {
  production: true,
  apiBaseUrl: '/busbooking/api',
  /** Polling satellitare con tempo all'arrivo superiore a 2 minuti. */
  bookingPollingIntervalFarMs: 30_000,
  /** Polling satellitare con tempo all'arrivo inferiore o uguale a 2 minuti. */
  bookingPollingIntervalNearMs: 20_000,
  /** Scostamento ETA oltre il quale aggiornare la stima e segnalare acusticamente. */
  bookingEtaChangeThresholdMs: 60_000
};

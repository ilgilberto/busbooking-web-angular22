import { Fermata } from '../services/stop.service';

/** Verifica valori numerici e limiti geografici senza alterare i dati del backend. */
export function hasValidStopCoordinates(stop: Fermata): boolean {
  const lat = Number(stop.latitudine);
  const lon = Number(stop.longitudine);
  return stop.latitudine !== null && stop.latitudine !== undefined
    && stop.longitudine !== null && stop.longitudine !== undefined
    && Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
    && !(lat === 0 && lon === 0);
}

export function mappableStops(stops: readonly Fermata[]): Fermata[] {
  return stops.filter(hasValidStopCoordinates);
}

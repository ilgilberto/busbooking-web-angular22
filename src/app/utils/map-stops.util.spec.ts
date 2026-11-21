import { describe, expect, it } from 'vitest';
import { Fermata } from '../services/stop.service';
import { hasValidStopCoordinates, mappableStops } from './map-stops.util';

const example: Fermata = {
  codice: '1', denominazione: 'Prova', ubicazione: 'Via Prova',
  latitudine: 44.5, longitudine: 11.3, distanza: 220
};

describe('Mappa fermate — validazione coordinate', () => {
  it('conserva le fermate geolocalizzate senza cambiare i dati', () => {
    expect(mappableStops([example])).toEqual([example]);
  });

  it('esclude coordinate assenti, non numeriche o fuori intervallo', () => {
    const invalid = [
      { ...example, latitudine: undefined },
      { ...example, longitudine: null },
      { ...example, latitudine: Number.NaN },
      { ...example, longitudine: Number.POSITIVE_INFINITY },
      { ...example, latitudine: 91 },
      { ...example, longitudine: -181 },
      { ...example, latitudine: 0, longitudine: 0 }
    ] as Fermata[];
    expect(mappableStops([...invalid, example])).toEqual([example]);
  });

  it('ammette coordinate sul limite e mantiene la selezione inalterata', () => {
    expect(hasValidStopCoordinates({ ...example, latitudine: -90, longitudine: 180 })).toBe(true);
  });
});

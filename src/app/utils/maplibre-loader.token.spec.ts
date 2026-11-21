import { describe, expect, it, vi } from 'vitest';
import { configureMaplibreWorker } from './maplibre-loader.token';

describe('Configurazione worker MapLibre GL JS 6', () => {
  it('risolve il worker per la build locale e aggiunge la versione anti-cache', () => {
    const setWorkerUrl = vi.fn();
    configureMaplibreWorker({ getVersion: () => '6.19.0', setWorkerUrl }, 'http://localhost:4200/');
    expect(setWorkerUrl).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:4200/assets/maplibre/maplibre-gl-worker.mjs?v=6.19.0'
    );
  });

  it('rispetta il percorso di deploy /busbooking/ senza cercare il worker nella root', () => {
    const setWorkerUrl = vi.fn();
    configureMaplibreWorker({ getVersion: () => '6.19.0', setWorkerUrl }, 'https://gilberto.info/busbooking/');
    expect(setWorkerUrl).toHaveBeenCalledExactlyOnceWith(
      'https://gilberto.info/busbooking/assets/maplibre/maplibre-gl-worker.mjs?v=6.19.0'
    );
  });
});

import { InjectionToken } from '@angular/core';

/** Caricamento lazy: la libreria cartografica viene scaricata solo aprendo la finestra. */
export const MAPLIBRE_LOADER = new InjectionToken<() => Promise<typeof import('maplibre-gl')>>(
  'BUSBOOKING_MAPLIBRE_LOADER',
  { providedIn: 'root', factory: () => () => import('maplibre-gl') }
);

/**
 * MapLibre 6 usa un Web Worker ESM separato: Angular/esbuild non puo' dedurne
 * automaticamente l'URL dopo il bundle. Entrambi i file .mjs sono copiati da
 * angular.json in /assets/maplibre/ durante serve/build.
 *
 * document.baseURI rispetta anche il deploy sotto /busbooking/.
 * La versione evita di riutilizzare dal browser un worker di una release precedente.
 */
export function configureMaplibreWorker(
  maplibre: Pick<typeof import('maplibre-gl'), 'setWorkerUrl' | 'getVersion'>,
  baseUri: string = document.baseURI
): void {
  const url = new URL('assets/maplibre/maplibre-gl-worker.mjs', baseUri);
  url.searchParams.set('v', maplibre.getVersion());
  maplibre.setWorkerUrl(url.href);
}

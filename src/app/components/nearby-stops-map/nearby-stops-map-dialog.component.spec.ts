import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NearbyStopsMapDialogComponent, NearbyStopsMapData } from './nearby-stops-map-dialog.component';
import { MAPLIBRE_LOADER } from '../../utils/maplibre-loader.token';
import { Fermata } from '../../services/stop.service';

const stop: Fermata = {
  codice: '128', denominazione: 'PIAZZA TEST', ubicazione: 'Via Test', comune: 'BOLOGNA',
  latitudine: 44.50, longitudine: 11.34, distanza: 200
};
const data: NearbyStopsMapData = {
  stops: [stop], userPosition: { latitude: 44.51, longitude: 11.32 }
};

describe('Mappa fermate vicine — dialog', () => {
  const close = vi.fn();
  const loadMap = vi.fn().mockRejectedValue(new Error('Browser senza WebGL'));

  beforeEach(async () => {
    close.mockClear();
    // Reimposta anche l'implementazione, non solo lo storico delle chiamate:
    // il mock del caso WebGL disponibile non deve contaminare gli altri test.
    loadMap.mockReset();
    loadMap.mockRejectedValue(new Error('Browser senza WebGL'));
    await TestBed.configureTestingModule({
      imports: [NearbyStopsMapDialogComponent],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAPLIBRE_LOADER, useValue: loadMap }
      ]
    }).compileComponents();
  });

  it('mostra anche un elenco selezionabile se WebGL o la cartografia non sono disponibili', async () => {
    const fixture = TestBed.createComponent(NearbyStopsMapDialogComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('PIAZZA TEST');

    // initializeMap() avvia un import asincrono. whenStable() da solo puo'
    // completarsi prima del catch e della successiva Change Detection.
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Mappa non disponibile');
    });
    expect(fixture.componentInstance.mapError).toContain('Mappa non disponibile');
    fixture.destroy();
  });

  it('seleziona una fermata e apre il percorso /stop mantenendo gli stessi query params della lista', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(NearbyStopsMapDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const select = fixture.nativeElement.querySelector('.bus-map-stop-choice') as HTMLButtonElement;
    select.click();
    fixture.detectChanges();
    const routes = fixture.nativeElement.querySelector('.bus-map-routes-button') as HTMLButtonElement;
    expect(routes).toBeTruthy();
    routes.click();
    expect(close).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/stop'], {
      queryParams: {
        codice: '128', nome: 'PIAZZA TEST', indirizzo: 'Via Test', long: 11.34, lat: 44.50
      }
    });
    fixture.destroy();
  });

  it('chiude senza navigare e senza richieste REST aggiuntive', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate');
    const fixture = TestBed.createComponent(NearbyStopsMapDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('.bus-map-close') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('disegna i marker MapLibre con longitudine prima e consente la selezione cliccando un punto', async () => {
    const markers: FakeMarker[] = [];
    class FakeMarker {
      readonly element: HTMLElement;
      coords: [number, number] = [0, 0];
      removed = false;
      constructor(options: { element: HTMLElement }) { this.element = options.element; }
      setLngLat(coords: [number, number]): this { this.coords = coords; return this; }
      addTo(): this { markers.push(this); return this; }
      remove(): void { this.removed = true; }
    }
    class FakeMap {
      addControl(): void {}
      on(): void {}
      once(_event: string, callback: () => void): void { callback(); }
      resize(): void {}
      fitBounds(): void {}
      jumpTo(): void {}
      easeTo(): void {}
      remove(): void {}
    }
    class FakeBounds { extend(): this { return this; } }
    class FakeNavigationControl { constructor(_options: object) {} }
    const setWorkerUrl = vi.fn();
    loadMap.mockResolvedValueOnce({
      Map: FakeMap, Marker: FakeMarker,
      NavigationControl: FakeNavigationControl, LngLatBounds: FakeBounds,
      getVersion: () => '6.19.0', setWorkerUrl
    });

    const fixture = TestBed.createComponent(NearbyStopsMapDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const worker = new URL('assets/maplibre/maplibre-gl-worker.mjs?v=6.19.0', document.baseURI).href;
    expect(setWorkerUrl).toHaveBeenCalledExactlyOnceWith(worker);
    expect(markers).toHaveLength(2); // fermata + posizione GPS
    expect(markers[0].coords).toEqual([11.34, 44.50]); // GeoJSON: longitudine prima
    expect(markers[1].coords).toEqual([11.32, 44.51]);
    markers[0].element.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedStop?.codice).toBe('128');
    expect(fixture.nativeElement.querySelector('.bus-map-routes-button')).toBeTruthy();
    fixture.destroy();
    expect(markers.every(marker => marker.removed)).toBe(true);
  });

});

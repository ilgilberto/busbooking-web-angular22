import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, ViewChild, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import { Fermata } from '../../services/stop.service';
import { mappableStops } from '../../utils/map-stops.util';
import { MAPLIBRE_LOADER, configureMaplibreWorker } from '../../utils/maplibre-loader.token';

export interface NearbyStopsMapData {
  stops: Fermata[];
  userPosition: { latitude: number; longitude: number } | null;
}

@Component({
  selector: 'app-nearby-stops-map-dialog',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './nearby-stops-map-dialog.component.html',
  styleUrl: './nearby-stops-map-dialog.component.scss'
})
export class NearbyStopsMapDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') private mapContainer?: ElementRef<HTMLDivElement>;

  readonly data: NearbyStopsMapData = inject<NearbyStopsMapData>(MAT_DIALOG_DATA);
  readonly validStops: Fermata[] = mappableStops(this.data.stops);
  readonly loadMapLibre = inject(MAPLIBRE_LOADER);
  selectedStop: Fermata | null = null;
  mapError: string | null = null;
  mapReady = false;
  private destroyed = false;
  private map?: MapLibreMap;
  private markers: MapLibreMarker[] = [];

  constructor(
    private readonly dialogRef: MatDialogRef<NearbyStopsMapDialogComponent>,
    private readonly router: Router,
    private readonly zone: NgZone,
    private readonly changeDetectorRef: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    if (this.validStops.length > 0) void this.initializeMap();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    for (const marker of this.markers) marker.remove();
    this.markers = [];
    this.map?.remove();
    this.map = undefined;
  }

  selectStop(stop: Fermata): void {
    if (!this.validStops.some(s => s.codice === stop.codice)) return;
    this.selectedStop = stop;
    this.map?.easeTo({ center: [Number(stop.longitudine), Number(stop.latitudine)], duration: 250 });
    this.changeDetectorRef.markForCheck();
  }

  viewSelectedRoutes(): void {
    if (!this.selectedStop) return;
    const stop = this.selectedStop;
    this.dialogRef.close();
    void this.router.navigate(['/stop'], {
      queryParams: {
        codice: stop.codice,
        nome: stop.denominazione,
        indirizzo: stop.ubicazione,
        long: stop.longitudine,
        lat: stop.latitudine
      }
    });
  }

  close(): void { this.dialogRef.close(); }

  formatDistance(distance: number | undefined): string {
    if (distance == null || !Number.isFinite(distance)) return 'Distanza non disponibile';
    return distance < 1000
      ? `${Math.round(distance)} m`
      : `${(distance / 1000).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
  }

  private async initializeMap(): Promise<void> {
    try {
      const maplibre = await this.loadMapLibre();
      if (this.destroyed || !this.mapContainer?.nativeElement) return;

      // Richiesto da MapLibre GL JS 6 con Angular/esbuild: senza un worker
      // ESM raggiungibile la mappa puo' rimanere vuota anche con marker visibili.
      configureMaplibreWorker(maplibre);

      const first = this.validStops[0];
      const map = new maplibre.Map({
        container: this.mapContainer.nativeElement,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [Number(first.longitudine), Number(first.latitudine)],
        zoom: 14,
        attributionControl: {}
      });
      this.map = map;
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

      for (const stop of this.validStops) {
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'bus-map-marker';
        pin.setAttribute('aria-label', `Seleziona fermata ${stop.denominazione}, codice ${stop.codice}`);
        pin.title = `${stop.codice} – ${stop.denominazione}`;
        const dot = document.createElement('span');
        dot.className = 'bus-map-marker-dot';
        dot.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'bus-map-marker-label';
        label.textContent = stop.denominazione;
        pin.append(dot, label);
        pin.addEventListener('click', event => {
          event.preventDefault();
          this.zone.run(() => this.selectStop(stop));
        });
        this.markers.push(new maplibre.Marker({ element: pin, anchor: 'bottom' })
          .setLngLat([Number(stop.longitudine), Number(stop.latitudine)]).addTo(map));
      }

      const position = this.data.userPosition;
      if (position && Number.isFinite(position.latitude) && Number.isFinite(position.longitude)
        && Math.abs(position.latitude) <= 90 && Math.abs(position.longitude) <= 180) {
        const userPin = document.createElement('span');
        userPin.className = 'bus-map-user-marker';
        userPin.setAttribute('role', 'img');
        userPin.setAttribute('aria-label', 'La tua posizione');
        userPin.title = 'La tua posizione';
        this.markers.push(new maplibre.Marker({ element: userPin })
          .setLngLat([position.longitude, position.latitude]).addTo(map));
      }

      map.once('load', () => {
        if (this.destroyed) return;
        map.resize();
        if (this.validStops.length === 1 && !this.data.userPosition) {
          map.jumpTo({ center: [Number(first.longitudine), Number(first.latitudine)], zoom: 15 });
        } else {
          const bounds = new maplibre.LngLatBounds();
          for (const stop of this.validStops) bounds.extend([Number(stop.longitudine), Number(stop.latitudine)]);
          if (position && Number.isFinite(position.latitude) && Number.isFinite(position.longitude)
            && Math.abs(position.latitude) <= 90 && Math.abs(position.longitude) <= 180) {
            bounds.extend([position.longitude, position.latitude]);
          }
          map.fitBounds(bounds, { padding: 65, maxZoom: 15, duration: 0 });
        }
        this.zone.run(() => {
          this.mapReady = true;
          this.changeDetectorRef.markForCheck();
        });
      });
      map.on('error', (event) => {
        // Conserva in console il motivo reale (worker, tiles, CORS, WebGL...),
        // invece di mostrare solo il generico avviso nell'interfaccia.
        console.error('[BusBooking] Errore cartografia MapLibre/OpenFreeMap:', event.error);
        if (this.destroyed || this.mapReady) return;
        this.zone.run(() => {
          this.mapError = 'Impossibile caricare la cartografia. Puoi comunque scegliere una fermata dall’elenco.';
          this.changeDetectorRef.markForCheck();
        });
      });
    } catch {
      if (this.destroyed) return;
      this.zone.run(() => {
        this.mapError = 'Mappa non disponibile. Puoi comunque scegliere una fermata dall’elenco.';
        this.changeDetectorRef.markForCheck();
      });
    }
  }
}

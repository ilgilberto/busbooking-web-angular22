import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Fermata, StopService } from '../../services/stop.service';
import { mappableStops } from '../../utils/map-stops.util';
import { NearbyStopsMapDialogComponent, NearbyStopsMapData } from '../nearby-stops-map/nearby-stops-map-dialog.component';

@Component({
  selector: 'app-nearby-stops',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, MatButtonModule, MatCardModule, MatProgressSpinnerModule, MatDialogModule, RouterLink],
  templateUrl: './nearby-stops.component.html',
  styleUrl: './nearby-stops.component.scss'
})
export class NearbyStopsComponent implements OnInit, OnDestroy {
  stops: Fermata[] = [];
  filterText = '';
  /** Testo effettivamente richiesto al backend. */
  appliedFilter = '';
  loading = false;
  private lastGpsPosition: { latitude: number; longitude: number } | null = null;
  error: string | null = null;
  searchError: string | null = null;
  validationMessage: string | null = null;

  private requestSubscription?: Subscription;
  private destroyed = false;
  private requestSequence = 0;

  constructor(
    private readonly stopService: StopService,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.findNearbyStops(null);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.requestSequence++;
    this.requestSubscription?.unsubscribe();
  }

  /**
   * Nel vecchio branch il filtro e' una richiesta REST /fermate con query e GPS,
   * NON un filtro sull'elenco gia' caricato e NON un parametro `nome`.
   */
  filtra(): void {
    const query = this.filterText.trim();
    if (query.length > 0 && query.length < 3) {
      this.validationMessage = 'Inserisci almeno 3 caratteri per cercare una fermata.';
      this.changeDetectorRef.markForCheck();
      return;
    }
    this.validationMessage = null;
    // Chiave vuota: ripristina le fermate vicine tramite lo stesso servizio.
    this.findNearbyStops(query || null, true);
  }

  /** Solo le fermate vicine (nessuna ricerca per chiave) possono essere rappresentate sulla mappa. */
  get canOpenNearbyMap(): boolean {
    return !this.loading && !this.error && !this.appliedFilter
      && mappableStops(this.stops).length > 0;
  }

  openNearbyMap(): void {
    if (!this.canOpenNearbyMap) return;
    const data: NearbyStopsMapData = {
      stops: mappableStops(this.stops),
      userPosition: this.lastGpsPosition
    };
    this.dialog.open(NearbyStopsMapDialogComponent, {
      data,
      width: '1080px',
      maxWidth: '96vw',
      height: 'min(90dvh, 850px)',
      maxHeight: '94dvh',
      panelClass: 'bus-nearby-map-dialog',
      autoFocus: 'dialog',
      restoreFocus: true,
      ariaLabel: 'Mappa delle fermate vicine'
    });
  }

  formatDistanza(metri: number | undefined): string {
    if (metri == null || !Number.isFinite(metri)) return 'Non disponibile';
    const number = new Intl.NumberFormat('it-IT', {
      minimumFractionDigits: metri < 1000 ? 0 : 1,
      maximumFractionDigits: metri < 1000 ? 0 : 1
    });
    return metri < 1000
      ? `${number.format(Math.round(metri))} m`
      : `${number.format(metri / 1000)} km`;
  }

  findNearbyStops(query: string | null = null, isSearch = false): void {
    this.requestSubscription?.unsubscribe();
    const requestId = ++this.requestSequence;
    this.loading = true;
    this.error = null;
    this.searchError = null;
    this.changeDetectorRef.markForCheck();

    if (!navigator.geolocation) {
      this.handleError(isSearch, 'Geolocalizzazione non supportata.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        if (this.destroyed || this.requestSequence !== requestId) return;
        const { latitude, longitude } = position.coords;
        this.requestSubscription = this.stopService.getNearbyStops(latitude, longitude, query)
          .subscribe({
            next: stops => {
              if (this.destroyed || this.requestSequence !== requestId) return;
              this.stops = stops;
              this.lastGpsPosition = { latitude, longitude };
              this.appliedFilter = query ?? '';
              this.loading = false;
              // Ripristino del GET /comune (text/plain) e della popup originale.
              this.stopService.getMunicipality(latitude, longitude);
              this.changeDetectorRef.markForCheck();
            },
            error: () => {
              if (this.destroyed || this.requestSequence !== requestId) return;
              this.handleError(isSearch, 'Errore nel recupero delle fermate.');
            }
          });
      },
      () => {
        if (this.destroyed || this.requestSequence !== requestId) return;
        this.handleError(isSearch, 'Impossibile ottenere la posizione.');
      }
    );
  }

  private handleError(isSearch: boolean, message: string): void {
    if (isSearch) {
      // Non perdere l'elenco gia' presente se la ricerca fallisce.
      this.searchError = message;
    } else {
      this.error = message;
    }
    this.loading = false;
    this.changeDetectorRef.markForCheck();
  }
}

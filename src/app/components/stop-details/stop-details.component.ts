import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BookingComponent } from '../booking/booking.component';
import { RouteService, Linea } from '../../services/route.service';
import { BookingService } from '../../services/booking.service';

@Component({
  selector: 'app-stop-details',
  standalone: true,
  imports: [NgIf, NgFor, MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, BookingComponent],
  templateUrl: './stop-details.component.html',
  styleUrl: './stop-details.component.scss'
})
export class StopDetailsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  codiceFermata = '';
  denominazione = '';
  indirizzo = '';
  longitudine = '';
  latitudine = '';
  corse: Linea[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly routeService: RouteService,
    private readonly router: Router,
    private readonly bookingService: BookingService
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.codiceFermata = params.get('codice') ?? '';
      this.denominazione = params.get('nome') ?? '';
      this.indirizzo = params.get('indirizzo') ?? '';
      this.longitudine = params.get('long') ?? '';
      this.latitudine = params.get('lat') ?? '';
      this.fetchCorse();
    });
  }

  get mapUrl(): string | null {
    const lat = Number(this.latitudine);
    const lon = Number(this.longitudine);
    if (!this.latitudine || !this.longitudine || !Number.isFinite(lat) || !Number.isFinite(lon)
      || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return `https://www.google.com/maps?q=${lat},${lon}`;
  }

  fetchCorse(): void {
    this.loading = true;
    this.error = null;
    if (!this.codiceFermata) {
      this.error = 'Codice fermata mancante.';
      this.loading = false;
      return;
    }
    this.routeService.getRoutesByStop(this.codiceFermata)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.corse = data;
          this.loading = false;
          this.changeDetectorRef.markForCheck();
        },
        error: () => {
          this.error = 'Errore nel recupero delle corse.';
          this.loading = false;
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  tornaAlleFermate(): void {
    this.bookingService.notifyAssistance('');
    void this.router.navigate(['/stops']);
  }
}

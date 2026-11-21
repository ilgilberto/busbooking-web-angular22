import { ChangeDetectorRef, Component, EventEmitter, inject, InjectionToken, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { NgIf } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { asyncScheduler, interval, SchedulerLike, Subscription } from 'rxjs';
import { Howl } from 'howler';
import { BookingService } from '../../services/booking.service';
import { environment } from '../../../environments/environment';
import { NOTICE_MESSAGE } from '../../utils/notice-message.util';

/** Scheduler e orologio sostituibili nei test, senza alterare i timer in produzione. */
export const BOOKING_SCHEDULER = new InjectionToken<SchedulerLike>('BOOKING_SCHEDULER', {
  providedIn: 'root', factory: () => asyncScheduler
});
export const BOOKING_NOW = new InjectionToken<() => number>('BOOKING_NOW', {
  providedIn: 'root', factory: () => () => Date.now()
});

/** La soglia di prossimità (2 minuti) è la stessa utilizzata per gli avvisi di arrivo. */
const SOGLIA_PROSSIMITA_MS = 2 * 60_000;

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [NgIf, MatButtonModule],
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.scss'
})
export class BookingComponent implements OnInit, OnDestroy {
  private static instanceCounter = 0;
  private readonly instanceId = ++BookingComponent.instanceCounter;
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly showNotice = inject(NOTICE_MESSAGE);
  private readonly scheduler = inject(BOOKING_SCHEDULER);
  private readonly now = inject(BOOKING_NOW);

  @Input() ora: string | undefined;
  @Output() oraChange = new EventEmitter<string | undefined>();
  @Input() fermata = '';
  @Input() linea = '';
  @Input() descrizione = '';

  tempoRestante = '';
  orarioStimato!: Date;
  private timerSub?: Subscription;
  private checkSub?: Subscription;
  private intervalloAttivoMs?: number;
  private verificaSub?: Subscription;
  private subKill?: Subscription;
  private readonly suono: Howl;
  private readonly arrivingSound: Howl;
  private session = 0;
  private inChiusura = false;
  private destroyed = false;
  beepAttivato = false;
  attivo = false;
  visibile = true;
  mostraConferma = false;
  assistenzaId = '';
  /** Intervallo correntemente applicato al polling satellitare, in millisecondi. */
  intervalloControllo = environment.bookingPollingIntervalFarMs;
  inArrivoMostrato = false;

  constructor(private readonly http: HttpClient, private readonly bookingService: BookingService) {
    this.suono = new Howl({ src: ['assets/suono.mp3'] });
    this.arrivingSound = new Howl({ src: ['assets/arrivo.mp3'], loop: true });
  }

  ngOnInit(): void {
    if (this.ora) this.orarioStimato = this.convertiOraInDate(this.ora);
    // Identificativo per istanza: distingue anche due corse con stesso veicolo, linea e fermata.
    this.assistenzaId = `${this.fermata}_${this.linea}_${this.descrizione}_${this.instanceId}`;
    this.subKill = this.bookingService.assistance$.subscribe(id => {
      if (this.attivo && id !== this.assistenzaId) this.interrompi(false);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.interrompi(false);
    this.subKill?.unsubscribe();
    this.suono.unload();
    this.arrivingSound.unload();
  }

  avvia(): void {
    if (this.attivo || !this.ora) return;
    const prevista = this.convertiOraInDate(this.ora);
    if (!Number.isFinite(prevista.getTime())) return;

    this.orarioStimato = prevista;
    ++this.session;
    this.inChiusura = false;
    this.beepAttivato = false;
    this.inArrivoMostrato = false;
    this.mostraConferma = false;
    this.intervalloAttivoMs = undefined;
    this.attivo = true;
    this.showNotice(`Ti fornirò assistenza per\n${this.descrizione}`, 3000, 'blue');
    this.bookingService.notifyAssistance(this.assistenzaId);

    // Countdown indipendente ogni secondo; polling inizializzato da aggiornaCountdown().
    // 30 s con ETA > 2 min, 20 s con ETA <= 2 min (entrambi configurabili).
    this.aggiornaCountdown();
    this.timerSub = interval(1000, this.scheduler).subscribe(() => this.aggiornaCountdown());
    this.markForCheck();
  }

  aggiornaCountdown(): void {
    if (!this.attivo || !this.orarioStimato || this.inChiusura) return;
    // Un arrivo passato non deve trasformarsi in un'attesa di 24 ore.
    const diff = Math.max(0, this.orarioStimato.getTime() - this.now());
    this.adeguaIntervalloControllo(diff);

    if (diff < SOGLIA_PROSSIMITA_MS && !this.beepAttivato) {
      this.arrivingSound.play();
      this.beepAttivato = true;
      this.mostraConferma = true;
    }
    if (diff < 60000) {
      if (!this.inArrivoMostrato) {
        this.showNotice("L'autobus è in arrivo", 2000, 'green');
        this.inArrivoMostrato = true;
      }
      this.tempoRestante = 'In arrivo';
    } else {
      this.inArrivoMostrato = false;
      const minuti = Math.floor(diff / 60000);
      const secondi = Math.floor((diff % 60000) / 1000);
      this.tempoRestante = `${minuti}m ${secondi}s`;
    }
    this.markForCheck();
  }

  /**
   * Riprogramma il polling soltanto quando si passa da una fascia all'altra.
   * Così un tick del countdown (ogni secondo) non posticipa continuamente la GET.
   * L'eventuale cambio dell'ETA dopo una risposta REST applica subito la nuova fascia.
   */
  private adeguaIntervalloControllo(tempoRestanteMs: number): void {
    if (!this.attivo || this.inChiusura) return;

    const nuovoIntervallo = tempoRestanteMs <= SOGLIA_PROSSIMITA_MS
      ? environment.bookingPollingIntervalNearMs
      : environment.bookingPollingIntervalFarMs;

    if (this.intervalloAttivoMs === nuovoIntervallo && this.checkSub && !this.checkSub.closed) return;

    this.checkSub?.unsubscribe();
    this.intervalloAttivoMs = nuovoIntervallo;
    this.intervalloControllo = nuovoIntervallo;
    this.checkSub = interval(nuovoIntervallo, this.scheduler).subscribe(() => this.verificaOrario());
  }

  verificaOrario(): void {
    if (!this.attivo || this.inChiusura || !this.fermata || !this.linea || !this.descrizione) return;
    const session = this.session;
    const params = new HttpParams().set('autobus', this.descrizione);
    const url = `${environment.apiBaseUrl}/fermata/${encodeURIComponent(this.fermata)}/${encodeURIComponent(this.linea)}`;
    this.verificaSub?.unsubscribe();
    this.verificaSub = this.http.get<number>(url, { params }).subscribe({
      next: minuti => {
        // Una risposta arrivata dopo cambio assistenza NON può più modificare questa corsa.
        if (!this.attivo || this.inChiusura || session !== this.session) return;
        if (minuti === -1) {
          this.inChiusura = true;
          this.timerSub?.unsubscribe();
          this.checkSub?.unsubscribe();
          this.arrivingSound.stop();
          this.suono.stop();
          this.mostraConferma = false;
          this.markForCheck();
          this.showNotice("L'autobus è arrivato", 4000, 'blue', () => {
            if (this.attivo && this.inChiusura && session === this.session) this.interrompi(true);
          });
        } else if (typeof minuti === 'number' && Number.isFinite(minuti) && minuti >= 0) {
          const nuovaOra = new Date(this.now());
          nuovaOra.setMinutes(nuovaOra.getMinutes() + minuti);
          if (Math.abs(this.orarioStimato.getTime() - nuovaOra.getTime()) > environment.bookingEtaChangeThresholdMs) {
            this.showNotice("L'orario è stato aggiornato", 3000);
            this.suono.play();
            this.orarioStimato = nuovaOra;
            // Un ETA posticipato rimette in attesa anche gli allarmi di prossimità.
            if (nuovaOra.getTime() - this.now() >= SOGLIA_PROSSIMITA_MS) {
              this.arrivingSound.stop();
              this.beepAttivato = false;
              this.mostraConferma = false;
            }
            this.aggiornaCountdown();
          }
        }
      },
      error: () => { /* Rete non disponibile: continua il countdown e riprova al ciclo successivo. */ }
    });
  }

  /** chiudi=true soltanto per arrivo effettivo: [(ora)] nasconde la corsa conclusa. */
  interrompi(chiudi = false): void {
    ++this.session; // invalida anche eventuali callback delle popup già aperte
    this.timerSub?.unsubscribe();
    this.checkSub?.unsubscribe();
    this.verificaSub?.unsubscribe();
    this.timerSub = undefined;
    this.checkSub = undefined;
    this.intervalloAttivoMs = undefined;
    this.verificaSub = undefined;
    this.suono.stop();
    this.arrivingSound.stop();
    this.attivo = false;
    this.inChiusura = false;
    this.mostraConferma = false;
    this.beepAttivato = false;
    this.inArrivoMostrato = false;
    if (chiudi) this.oraChange.emit(undefined);
    this.markForCheck();
  }

  confirmArriving(): void {
    this.mostraConferma = false;
    this.arrivingSound.stop();
    this.markForCheck();
  }

  private convertiOraInDate(oraStr: string): Date {
    const [hh, mm] = oraStr.split(':').map(Number);
    const ora = new Date(this.now());
    if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      return new Date(NaN);
    }
    ora.setHours(hh, mm, 0, 0);
    // Corse dopo mezzanotte: se 00:06 è mostrato alle 23:41, è il giorno seguente.
    // Evita invece di riportare al giorno dopo una corsa scaduta da pochi minuti.
    if (ora.getTime() - this.now() < -12 * 60 * 60 * 1000) ora.setDate(ora.getDate() + 1);
    return ora;
  }

  private markForCheck(): void {
    if (!this.destroyed) this.changeDetector.markForCheck();
  }
}

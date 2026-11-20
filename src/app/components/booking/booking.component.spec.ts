import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Howl } from 'howler';
import { VirtualTimeScheduler } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingComponent, BOOKING_NOW, BOOKING_SCHEDULER } from './booking.component';
import { BookingService } from '../../services/booking.service';
import { environment } from '../../../environments/environment';
import { NOTICE_MESSAGE } from '../../utils/notice-message.util';

const UPDATE_URL = `${environment.apiBaseUrl}/fermata/100/23`;

describe('BookingComponent – regressioni assistenza rispetto al branch Angular 13', () => {
  let http: HttpTestingController;
  let showNotice: ReturnType<typeof vi.fn>;
  let virtualTime: VirtualTimeScheduler;
  let startTime: number;

  beforeEach(async () => {
    virtualTime = new VirtualTimeScheduler(undefined, 0);
    startTime = new Date(2026, 10, 20, 23, 40, 0).getTime();
    showNotice = vi.fn();
    await TestBed.configureTestingModule({
      imports: [BookingComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NOTICE_MESSAGE, useValue: showNotice },
        { provide: BOOKING_SCHEDULER, useValue: virtualTime },
        { provide: BOOKING_NOW, useValue: () => startTime + virtualTime.frame }
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });

  function createBooking(ora = '23:45', fermata = '100', linea = '23', descrizione = 'Bus6047') {
    const fixture = TestBed.createComponent(BookingComponent);
    fixture.componentRef.setInput('ora', ora);
    fixture.componentRef.setInput('fermata', fermata);
    fixture.componentRef.setInput('linea', linea);
    fixture.componentRef.setInput('descrizione', descrizione);
    fixture.detectChanges();
    return fixture;
  }

  function runUntil(ms: number): void {
    virtualTime.maxFrames = ms;
    virtualTime.flush();
  }

  it('non parte automaticamente e mostra il pulsante Prenota assistenza', () => {
    const fixture = createBooking();
    expect(fixture.componentInstance.attivo).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Prenota assistenza');
    fixture.destroy();
  });

  it('diminuisce realmente ogni secondo e aggiorna il testo Angular nel DOM', () => {
    const fixture = createBooking();
    fixture.componentInstance.avvia();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('5m 0s');

    runUntil(1000);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('4m 59s');
    runUntil(3000);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('4m 57s');
    fixture.destroy();
  });

  it('chiama GET /fermata/{fermata}/{linea}?autobus=... ogni 30 secondi', () => {
    const fixture = createBooking();
    fixture.componentInstance.avvia();
    runUntil(29999);
    http.expectNone(r => r.url === UPDATE_URL);
    runUntil(30000);
    const req1 = http.expectOne(r => r.url === UPDATE_URL);
    expect(req1.request.method).toBe('GET');
    expect(req1.request.params.get('autobus')).toBe('Bus6047');
    req1.flush(4);

    runUntil(60000);
    const req2 = http.expectOne(r => r.url === UPDATE_URL);
    req2.flush(3);
    fixture.destroy();
  });

  it('se il servizio varia la previsione di oltre 60 secondi aggiorna ETA e avvisa con suono', () => {
    const audio = vi.spyOn(Howl.prototype, 'play').mockReturnValue(1);
    const fixture = createBooking('23:50');
    const booking = fixture.componentInstance;
    booking.avvia();
    booking.verificaOrario();
    const req = http.expectOne(r => r.url === UPDATE_URL);
    req.flush(5);
    expect(booking.tempoRestante).toContain('5m');
    expect(showNotice).toHaveBeenCalledWith("L'orario è stato aggiornato", 3000);
    expect(audio).toHaveBeenCalled();
    fixture.destroy();
  });

  it('una variazione non superiore a 60 secondi non genera un avviso acustico', () => {
    const audio = vi.spyOn(Howl.prototype, 'play').mockReturnValue(1);
    const fixture = createBooking('23:45');
    fixture.componentInstance.avvia();
    fixture.componentInstance.verificaOrario();
    http.expectOne(r => r.url === UPDATE_URL).flush(5);
    expect(showNotice).not.toHaveBeenCalledWith("L'orario è stato aggiornato", 3000);
    expect(audio).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('avvisa con audio sotto 2 minuti e mostra In arrivo sotto 1 minuto', () => {
    startTime = new Date(2026, 10, 20, 23, 39, 30).getTime();
    const audio = vi.spyOn(Howl.prototype, 'play').mockReturnValue(1);
    const fixture = createBooking('23:41');
    const booking = fixture.componentInstance;
    booking.avvia();
    expect(booking.tempoRestante).toBe('1m 30s');
    expect(booking.beepAttivato).toBe(true);
    expect(booking.mostraConferma).toBe(true);
    expect(audio).toHaveBeenCalledTimes(1);
    runUntil(31000);
    expect(booking.tempoRestante).toBe('In arrivo');
    expect(showNotice).toHaveBeenCalledWith("L'autobus è in arrivo", 2000, 'green');
    booking.confirmArriving();
    expect(booking.mostraConferma).toBe(false);
    http.expectOne(r => r.url === UPDATE_URL).flush(1);
    fixture.destroy();
  });

  it('al -1 mostra la notifica di arrivo e dopo la popup emette oraChange(undefined)', () => {
    const fixture = createBooking();
    const booking = fixture.componentInstance;
    const events: Array<string | undefined> = [];
    booking.oraChange.subscribe(v => events.push(v));
    booking.avvia();
    booking.verificaOrario();
    http.expectOne(r => r.url === UPDATE_URL).flush(-1);
    expect(showNotice).toHaveBeenCalledWith("L'autobus è arrivato", 4000, 'blue', expect.any(Function));
    expect(events).toEqual([]); // come nell'originale: chiusura dopo la notifica
    const done = showNotice.mock.calls.find(call => call[0] === "L'autobus è arrivato")?.[3];
    expect(done).toBeTypeOf('function');
    done();
    expect(events).toEqual([undefined]);
    expect(booking.attivo).toBe(false);
    fixture.destroy();
  });

  it('se parte un’altra assistenza, interrompe timer, polling e audio della precedente', () => {
    const stopSound = vi.spyOn(Howl.prototype, 'stop');
    const first = createBooking('23:50');
    const second = createBooking('23:55', '101', '23', 'Bus6048');
    first.componentInstance.avvia();
    runUntil(30000);
    const pending = http.expectOne(r => r.url === UPDATE_URL);
    second.componentInstance.avvia();
    expect(first.componentInstance.attivo).toBe(false);
    expect(second.componentInstance.attivo).toBe(true);
    expect(pending.cancelled).toBe(true);
    expect(stopSound).toHaveBeenCalled();
    runUntil(60000);
    http.expectNone(r => r.url === UPDATE_URL); // il vecchio polling non deve ripartire
    const newRequest = http.expectOne(r => r.url === `${environment.apiBaseUrl}/fermata/101/23`);
    newRequest.flush(5);
    first.destroy();
    second.destroy();
  });

  it('distingue due istanze con stesso veicolo, fermata, linea e orario', () => {
    const first = createBooking();
    const second = createBooking();
    expect(first.componentInstance.assistenzaId).not.toBe(second.componentInstance.assistenzaId);
    first.componentInstance.avvia();
    second.componentInstance.avvia();
    expect(first.componentInstance.attivo).toBe(false);
    expect(second.componentInstance.attivo).toBe(true);
    first.destroy();
    second.destroy();
  });

  it('non chiude una corsa con una vecchia popup -1 dopo il cambio assistenza', () => {
    const first = createBooking();
    const second = createBooking('23:55', '101', '23', 'Bus6048');
    const events: Array<string | undefined> = [];
    first.componentInstance.oraChange.subscribe(v => events.push(v));
    first.componentInstance.avvia();
    first.componentInstance.verificaOrario();
    http.expectOne(r => r.url === UPDATE_URL).flush(-1);
    const done = showNotice.mock.calls.find(call => call[0] === "L'autobus è arrivato")?.[3];
    second.componentInstance.avvia();
    done();
    expect(events).toEqual([]);
    expect(first.componentInstance.attivo).toBe(false);
    expect(second.componentInstance.attivo).toBe(true);
    first.destroy();
    second.destroy();
  });

  it('una corsa delle 00:06 alle 23:40 attende 26 minuti, non zero o oltre 24 ore', () => {
    const fixture = createBooking('00:06');
    fixture.componentInstance.avvia();
    expect(fixture.componentInstance.tempoRestante).toBe('26m 0s');
    fixture.destroy();
  });

  it('una corsa scaduta da pochi minuti non torna a 23 ore di attesa', () => {
    startTime = new Date(2026, 10, 20, 23, 43, 0).getTime();
    const audio = vi.spyOn(Howl.prototype, 'play').mockReturnValue(1);
    const fixture = createBooking('23:41');
    fixture.componentInstance.avvia();
    expect(fixture.componentInstance.tempoRestante).toBe('In arrivo');
    expect(audio).toHaveBeenCalled();
    fixture.destroy();
  });

  it('alla nuova prenotazione della stessa corsa ripristina gli allarmi', () => {
    startTime = new Date(2026, 10, 20, 23, 39, 30).getTime();
    const audio = vi.spyOn(Howl.prototype, 'play').mockReturnValue(1);
    const fixture = createBooking('23:41');
    fixture.componentInstance.avvia();
    fixture.componentInstance.interrompi(false);
    fixture.componentInstance.avvia();
    expect(audio).toHaveBeenCalledTimes(2);
    fixture.destroy();
  });

  it('un errore HTTP non chiude l’assistenza, che potrà riprovare al successivo polling', () => {
    const fixture = createBooking();
    fixture.componentInstance.avvia();
    fixture.componentInstance.verificaOrario();
    http.expectOne(r => r.url === UPDATE_URL).flush('Errore', { status: 503, statusText: 'Service Unavailable' });
    expect(fixture.componentInstance.attivo).toBe(true);
    runUntil(30000);
    http.expectOne(r => r.url === UPDATE_URL).flush(4);
    fixture.destroy();
  });
});

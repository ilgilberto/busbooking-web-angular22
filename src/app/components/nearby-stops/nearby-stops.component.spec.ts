import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NearbyStopsComponent } from './nearby-stops.component';
import { Fermata, StopService } from '../../services/stop.service';

const nearby: Fermata = {
  codice: '100', denominazione: 'Piazza Test', ubicazione: 'Via Test 1',
  comune: 'BOLOGNA', latitudine: 44.5, longitudine: 11.34, distanza: 250
};
const filtered: Fermata = {
  codice: '6454', denominazione: 'BATTINDARNO SEGANTINI', ubicazione: 'VIA BATTINDARNO',
  comune: 'BOLOGNA', latitudine: 44.6, longitudine: 11.4, distanza: 1500
};
const position: GeolocationPosition = {
  coords: {
    latitude: 44.5, longitude: 11.34, accuracy: 10,
    altitude: null, altitudeAccuracy: null, heading: null, speed: null,
    toJSON() { return { latitude: this.latitude, longitude: this.longitude }; }
  },
  timestamp: 0,
  toJSON() { return { coords: this.coords.toJSON(), timestamp: this.timestamp }; }
};

describe('NearbyStopsComponent – ricerca remota originale', () => {
  let getNearbyStops: ReturnType<typeof vi.fn>;
  let getMunicipality: ReturnType<typeof vi.fn>;
  let geolocationDescriptor: PropertyDescriptor | undefined;

  beforeEach(async () => {
    geolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: vi.fn((success: PositionCallback) => success(position)) }
    });
    getNearbyStops = vi.fn().mockReturnValue(of([nearby]));
    getMunicipality = vi.fn();
    await TestBed.configureTestingModule({
      imports: [NearbyStopsComponent],
      providers: [
        provideRouter([]),
        { provide: StopService, useValue: { getNearbyStops, getMunicipality } }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    if (geolocationDescriptor) Object.defineProperty(navigator, 'geolocation', geolocationDescriptor);
    else Reflect.deleteProperty(navigator, 'geolocation');
  });

  it('visualizza le fermate vicine, il comune e la distanza formattata', async () => {
    const fixture = TestBed.createComponent(NearbyStopsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getNearbyStops).toHaveBeenCalledWith(44.5, 11.34, null);
    expect(getMunicipality).toHaveBeenCalledWith(44.5, 11.34);
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Piazza Test');
    expect(text).toContain('BOLOGNA');
    expect(text).toContain('250 m');
    fixture.destroy();
  });

  it('mantiene il filtro DOPO le fermate senza spazio fisso sotto', async () => {
    const fixture = TestBed.createComponent(NearbyStopsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.nativeElement.querySelector('.stops-page') as HTMLElement;
    expect(page.lastElementChild?.classList.contains('filter-panel')).toBe(true);
    const list = page.querySelector('.stops-list') as HTMLElement;
    const filter = page.querySelector('.filter-panel') as HTMLElement;
    expect(list.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fixture.destroy();
  });

  it('mostra il logo durante HTTP e lo rimuove al termine', async () => {
    const pending = new Subject<Fermata[]>();
    getNearbyStops.mockReturnValueOnce(pending.asObservable());
    const fixture = TestBed.createComponent(NearbyStopsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const overlay = fixture.nativeElement.querySelector('.bus-stops-loading') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector('img')?.getAttribute('src'))
      .toBe('assets/conoscenza-creativa-caricamento.png');
    pending.next([nearby]);
    pending.complete();
    expect(fixture.componentInstance.loading).toBe(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.bus-stops-loading')).toBeNull();
    fixture.destroy();
  });

  it('invoca di nuovo /fermate con query + GPS e sostituisce la lista visualizzata', async () => {
    getNearbyStops.mockReturnValueOnce(of([nearby])).mockReturnValueOnce(of([filtered]));
    const fixture = TestBed.createComponent(NearbyStopsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.filterText = '  Battindarno  ';
    fixture.componentInstance.filtra();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getNearbyStops).toHaveBeenNthCalledWith(2, 44.5, 11.34, 'Battindarno');
    expect(getMunicipality).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('BATTINDARNO SEGANTINI');
    expect(fixture.nativeElement.textContent).toContain('1,5 km');
    expect(fixture.nativeElement.textContent).not.toContain('Piazza Test');
    expect(fixture.nativeElement.textContent).toContain('Fermate trovate');
    fixture.destroy();
  });

  it('rifiuta chiavi di 1-2 caratteri senza richiamare il servizio', async () => {
    const fixture = TestBed.createComponent(NearbyStopsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.filterText = 'vi';
    fixture.componentInstance.filtra();
    fixture.detectChanges();
    expect(getNearbyStops).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('almeno 3 caratteri');
    fixture.destroy();
  });

  it('con filtro vuoto ricarica le fermate vicine tramite REST', async () => {
    getNearbyStops.mockReturnValueOnce(of([nearby])).mockReturnValueOnce(of([filtered]))
      .mockReturnValueOnce(of([nearby]));
    const fixture = TestBed.createComponent(NearbyStopsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.filterText = 'Battindarno';
    fixture.componentInstance.filtra();
    fixture.componentInstance.filterText = '';
    fixture.componentInstance.filtra();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getNearbyStops).toHaveBeenNthCalledWith(3, 44.5, 11.34, null);
    expect(fixture.nativeElement.textContent).toContain('Piazza Test');
    expect(fixture.nativeElement.textContent).not.toContain('BATTINDARNO SEGANTINI');
    fixture.destroy();
  });

  it('non sovrascrive i risultati con una risposta obsoleta di una ricerca precedente', async () => {
    const first = new Subject<Fermata[]>();
    getNearbyStops.mockReturnValueOnce(of([nearby])).mockReturnValueOnce(first.asObservable())
      .mockReturnValueOnce(of([filtered]));
    const fixture = TestBed.createComponent(NearbyStopsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.filterText = 'Piazza';
    fixture.componentInstance.filtra();
    fixture.componentInstance.filterText = 'Battindarno';
    fixture.componentInstance.filtra();
    first.next([nearby]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('BATTINDARNO SEGANTINI');
    expect(fixture.nativeElement.textContent).not.toContain('Piazza Test');
    fixture.destroy();
  });
});

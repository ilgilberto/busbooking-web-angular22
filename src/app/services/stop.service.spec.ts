import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { NOTICE_MESSAGE } from '../utils/notice-message.util';
import { StopService } from './stop.service';

describe('StopService – contratto del branch funzione_filtra_fermate', () => {
  let service: StopService;
  let http: HttpTestingController;
  let showNotice: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    showNotice = vi.fn();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: NOTICE_MESSAGE, useValue: showNotice }
    ] });
    service = TestBed.inject(StopService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('chiede le fermate vicine con latitudine e longitudine senza query', () => {
    let count = -1;
    service.getNearbyStops(44.5, 11.34).subscribe(stops => count = stops.length);
    const req = http.expectOne(r => r.url === `${environment.apiBaseUrl}/fermate`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('latitudine')).toBe('44.5');
    expect(req.request.params.get('longitudine')).toBe('11.34');
    expect(req.request.params.has('query')).toBe(false);
    expect(req.request.params.has('nome')).toBe(false);
    req.flush([{ codice: '100', denominazione: 'Test', ubicazione: 'Via Test',
      latitudine: 44.6, longitudine: 11.5, distanza: 237, comune: 'BOLOGNA' }]);
    expect(count).toBe(1);
  });

  it('filtra remotamente usando query + coordinate come nel branch originale', () => {
    let distanza: number | undefined;
    service.getNearbyStops(44.5, 11.34, '  Battindarno  ')
      .subscribe(stops => distanza = stops[0]?.distanza);
    const req = http.expectOne(r => r.url === `${environment.apiBaseUrl}/fermate`);
    expect(req.request.params.get('latitudine')).toBe('44.5');
    expect(req.request.params.get('longitudine')).toBe('11.34');
    expect(req.request.params.get('query')).toBe('Battindarno');
    expect(req.request.params.has('nome')).toBe(false);
    req.flush([{ codice: '6454', denominazione: 'BATTINDARNO SEGANTINI',
      ubicazione: 'VIA BATTINDARNO', latitudine: 44.4, longitudine: 11.3, distanza: 1250 }]);
    // Deve usare i metri restituiti dal backend, non ricalcolarli nel frontend.
    expect(distanza).toBe(1250);
  });

  it('recupera il comune come text/plain e invoca la popup Riferimento', () => {
    service.getMunicipality(44.5, 11.34);
    const req = http.expectOne(r => r.url === `${environment.apiBaseUrl}/comune`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('text');
    expect(req.request.params.get('latitudine')).toBe('44.5');
    expect(req.request.params.get('longitudine')).toBe('11.34');
    req.flush('BOLOGNA');
    expect(showNotice).toHaveBeenCalledWith('Riferimento\nBOLOGNA', 3000);
  });
});

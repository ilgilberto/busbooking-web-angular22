import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StopDetailsComponent } from './stop-details.component';
import { RouteService, Linea } from '../../services/route.service';
import { BookingComponent } from '../booking/booking.component';
import { By } from '@angular/platform-browser';

const lines: Linea[] = [{
  codice: '27', message: 'Direzione Centro',
  corse: [{ codiceLinea: '27', ora: '12:30', tipologiaOrario: 'DA_SATELLITE', descrizione: 'BUS1' }]
}];

describe('StopDetailsComponent – regressioni del branch', () => {
  let getRoutesByStop: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getRoutesByStop = vi.fn().mockReturnValue(of(lines.map(line => ({
      ...line, corse: line.corse.map(corsa => ({ ...corsa }))
    }))));
    await TestBed.configureTestingModule({
      imports: [StopDetailsComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({
          codice: '123', nome: 'Stazione', indirizzo: 'Piazza Centrale',
          lat: '44.50', long: '11.34'
        })) } },
        { provide: RouteService, useValue: { getRoutesByStop } }
      ]
    }).compileComponents();
  });

  it('recupera le corse e ripristina il link geolocalizzato a Google Maps', () => {
    const fixture = TestBed.createComponent(StopDetailsComponent);
    fixture.detectChanges();
    expect(getRoutesByStop).toHaveBeenCalledWith('123');
    expect(fixture.nativeElement.textContent).toContain('Linea 27');
    const link = fixture.nativeElement.querySelector('a[title="Apri su Google Maps"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toContain('maps?q=44.5,11.34');
    fixture.destroy();
  });

  it('propaga oraChange(undefined) dalla prenotazione alla corsa come nella versione vecchia', () => {
    const fixture = TestBed.createComponent(StopDetailsComponent);
    fixture.detectChanges();
    const child = fixture.debugElement.query(By.directive(BookingComponent));
    expect(child).toBeTruthy();
    (child.componentInstance as BookingComponent).oraChange.emit(undefined);
    fixture.detectChanges();
    expect(fixture.componentInstance.corse[0]?.corse[0]?.ora).toBeUndefined();
    expect(fixture.debugElement.query(By.directive(BookingComponent))).toBeNull();
    fixture.destroy();
  });
});

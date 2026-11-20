import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { environment } from '../../environments/environment';
import { RouteService } from './route.service';

describe('RouteService', () => {
  let service: RouteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RouteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('recupera le linee usando la medesima API', () => {
    let linee = 0;
    service.getRoutesByStop('100').subscribe(result => linee = result.length);
    const req = http.expectOne(`${environment.apiBaseUrl}/fermata/100`);
    req.flush([{ codice: '27', message: 'Centro', corse: [] }]);
    expect(linee).toBe(1);
  });
});

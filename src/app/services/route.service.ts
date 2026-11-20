import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Corsa {
  codiceLinea: string;
  ora?: string;
  tipologiaOrario?: string;
  descrizione?: string;
}

export interface Linea {
  codice: string;
  message?: string;
  corse: Corsa[];
}

@Injectable({ providedIn: 'root' })
export class RouteService {
  private readonly apiUrl = `${environment.apiBaseUrl}/fermata`;

  constructor(private readonly http: HttpClient) {}

  getRoutesByStop(codice: string): Observable<Linea[]> {
    return this.http.get<Linea[]>(`${this.apiUrl}/${encodeURIComponent(codice)}`);
  }
}

import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { NOTICE_MESSAGE } from '../utils/notice-message.util';

export interface Fermata {
  codice: string;
  denominazione: string;
  ubicazione: string;
  comune?: string;
  latitudine: number;
  longitudine: number;
  distanza?: number;
}

@Injectable({ providedIn: 'root' })
export class StopService {
  private readonly showNotice = inject(NOTICE_MESSAGE);
  private readonly apiUrlRetrieveStops = `${environment.apiBaseUrl}/fermate`;
  private readonly apiUrlRetrieveMunicipality = `${environment.apiBaseUrl}/comune`;

  constructor(private readonly http: HttpClient) {}

  /**
   * Contratto verificato sul branch Angular 13 funzione_filtra_fermate:
   * GET /fermate?latitudine=...&longitudine=...&query=...
   * In assenza di query, si recuperano le fermate vicine.
   */
  getNearbyStops(lat: number, lon: number, query: string | null = null): Observable<Fermata[]> {
    let params = new HttpParams()
      .set('latitudine', lat.toString())
      .set('longitudine', lon.toString());

    const normalizedQuery = query?.trim();
    if (normalizedQuery) {
      params = params.set('query', normalizedQuery);
    }
    // Non ricalcolare la distanza: il servizio restituisce gia' il campo `distanza`.
    return this.http.get<Fermata[]>(this.apiUrlRetrieveStops, { params });
  }

  /**
   * Contratto verificato sul branch originale: risposta HTTP testuale, NON JSON.
   * Riproduce l'avviso animato "Riferimento <Comune>" della vecchia versione.
   */
  getMunicipality(lat: number, lon: number): void {
    const params = new HttpParams()
      .set('latitudine', lat.toString())
      .set('longitudine', lon.toString());
    this.http.get(this.apiUrlRetrieveMunicipality, { params, responseType: 'text' })
      .subscribe({
        next: municipality => this.showNotice(`Riferimento\n${municipality}`, 3000),
        error: err => console.error('Errore nel recupero comune', err)
      });
  }
}

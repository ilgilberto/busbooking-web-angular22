import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { BookingService } from './booking.service';

describe('BookingService', () => {
  it('invia una notifica quando si avvia una nuova assistenza', () => {
    const service = TestBed.inject(BookingService);
    const ricevuti: string[] = [];
    const sub = service.assistance$.subscribe(id => ricevuti.push(id));
    service.notifyAssistance('bus-27');
    expect(ricevuti).toEqual(['bus-27']);
    sub.unsubscribe();
  });
});

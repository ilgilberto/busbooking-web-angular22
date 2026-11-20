import { afterEach, describe, expect, it, vi } from 'vitest';
import { getReferenceCity, showReferenceSplash } from './reference-splash.util';

describe('Schermata Riferimento', () => {
  afterEach(() => {
    document.querySelectorAll('.bus-reference-overlay').forEach(el => el.remove());
    vi.useRealTimers();
  });

  it('riconosce le tre citta e non inventa riferimenti fuori zona', () => {
    expect(getReferenceCity(44.4949, 11.3426)).toBe('BOLOGNA');
    expect(getReferenceCity(44.353, 11.7148)).toBe('IMOLA');
    expect(getReferenceCity(44.8381, 11.6198)).toBe('FERRARA');
    expect(getReferenceCity(45.4642, 9.19)).toBeNull();
  });

  it('mostra la popup animata e la rimuove automaticamente', () => {
    vi.useFakeTimers();
    showReferenceSplash('BOLOGNA', 2000);
    expect(document.body.textContent).toContain('Riferimento');
    expect(document.body.textContent).toContain('BOLOGNA');
    vi.advanceTimersByTime(2000);
    expect(document.querySelector('.bus-reference-overlay')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { advanceFooterBannerOffset } from './footer-banner-motion.util';

describe('Movimento del footer da destra verso sinistra', () => {
  it('fa avanzare il primo banner verso sinistra alla velocità configurata', () => {
    expect(advanceFooterBannerOffset(0, 1000, 42, 120, 320, 48, true)).toBe(-42);
    expect(advanceFooterBannerOffset(-42, 500, 42, 300, 320, 48, true)).toBe(-63);
    expect(advanceFooterBannerOffset(-42, 1000, 0, 120, 320, 48, true)).toBe(-42);
  });

  it('non ricomincia finché l’ultimo banner non è uscito completamente a sinistra', () => {
    // Totale percorso: 320 (viewport) + 120 (strip) + 48 (vuoto) = 488px.
    expect(advanceFooterBannerOffset(-440, 1000, 42, 120, 320, 48, true)).toBe(-482);
    expect(advanceFooterBannerOffset(-488, 1000, 42, 120, 320, 48, true)).toBe(0);
  });

  it('tiene conto di tutte le immagini: il riavvio non taglia il banner finale', () => {
    // Con tre immagini da 100px il viaggio totale è 320 + 300 + 48 = 668px.
    expect(advanceFooterBannerOffset(-600, 1000, 42, 300, 320, 48, true)).toBe(-642);
    expect(advanceFooterBannerOffset(-668, 1000, 42, 300, 320, 48, true)).toBe(0);
  });

  it('aspetta la fine della scoperta immagini prima di ricominciare', () => {
    expect(advanceFooterBannerOffset(-488, 1000, 42, 120, 320, 48, false)).toBe(-488);
  });


  it('include nel percorso anche i gap tra i banner, evitando riavvii prematuri', () => {
    // Due immagini da 100px: con gap 12px su mobile il convoglio è largo 212px.
    // Lo spazio è fra le immagini, non prima della prima né dopo l'ultima.
    for (const gapPx of [12, 18, 24]) {
      const viewportPx = 360;
      const stripWidthPx = 2 * 100 + gapPx;
      const completeTravelPx = viewportPx + stripWidthPx + 48;
      expect(advanceFooterBannerOffset(-completeTravelPx + 1, 0, 42,
        stripWidthPx, viewportPx, 48, true)).toBe(-completeTravelPx + 1);
      expect(advanceFooterBannerOffset(-completeTravelPx, 0, 42,
        stripWidthPx, viewportPx, 48, true)).toBe(0);
    }
  });

  it('calcola correttamente la fine del convoglio con tre banner e due spazi', () => {
    const viewportPx = 375;
    const bannerWidthsPx = [240, 120, 360];
    const gapPx = 12;
    const stripWidthPx = bannerWidthsPx.reduce((a, b) => a + b, 0) + 2 * gapPx;
    const travelPx = viewportPx + stripWidthPx + 48;
    expect(advanceFooterBannerOffset(-travelPx + 0.01, 0, 42,
      stripWidthPx, viewportPx, 48, true)).toBeCloseTo(-travelPx + 0.01);
    expect(advanceFooterBannerOffset(-travelPx, 0, 42,
      stripWidthPx, viewportPx, 48, true)).toBe(0);
  });

  it('non produce movimento con velocità nulla o tempo negativo', () => {
    expect(advanceFooterBannerOffset(-125, 2000, 0, 240, 375, 48, true)).toBe(-125);
    expect(advanceFooterBannerOffset(-125, -500, 42, 240, 375, 48, true)).toBe(-125);
  });

  it('non fa retrocedere il tempo in caso di timestamp non crescente', () => {
    expect(advanceFooterBannerOffset(-42, -500, 42, 120, 320, 48, true)).toBe(-42);
  });
});

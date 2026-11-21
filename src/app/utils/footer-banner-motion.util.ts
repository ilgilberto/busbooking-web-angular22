/**
 * Offset orizzontale del convoglio rispetto alla posizione iniziale, in pixel:
 * 0 = primo banner appena fuori dal bordo destro del viewport;
 * valori negativi = movimento verso sinistra.
 *
 * Immagini in ordine naturale (imm0, imm1, ...), con gap responsive: la larghezza
 * misurata con offsetWidth include sia le immagini sia gli spazi intermedi.
 * Si ricomincia soltanto quando TUTTO il convoglio è uscito a sinistra,
 * seguito da un ulteriore margine vuoto. Durante la ricerca delle immagini
 * il convoglio resta fuori finché la sequenza non è conclusa, se necessario.
 */
export function advanceFooterBannerOffset(
  currentOffsetPx: number,
  elapsedMs: number,
  speedPxPerSecond: number,
  totalStripWidthPx: number,
  viewportWidthPx: number,
  emptyGapPx: number,
  sequenceComplete: boolean
): number {
  // La strip inizia a viewportWidthPx (CSS left: 100%):
  // il suo bordo destro è viewportWidthPx + offset + totalStripWidthPx.
  const completelyOutLeft =
    viewportWidthPx + currentOffsetPx + totalStripWidthPx <= -emptyGapPx;

  if (completelyOutLeft) {
    return sequenceComplete ? 0 : currentOffsetPx;
  }

  // Il movimento verso sinistra richiede un offset progressivamente negativo.
  return currentOffsetPx - Math.max(0, elapsedMs) * Math.max(0, speedPxPerSecond) / 1000;
}

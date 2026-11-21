import { InjectionToken } from '@angular/core';

/** Dimensioni intrinseche dell'immagine: consentono di mantenere le proporzioni nel footer. */
export interface FooterBannerDimensions {
  width: number;
  height: number;
}

export type FooterBannerImageLoader = (url: string) => Promise<FooterBannerDimensions>;

/**
 * Carica le immagini tramite HTMLImageElement, senza CORS né richieste HEAD.
 * Anche una risposta HTTP 200 con contenuto che non è un'immagine viene scartata.
 */
export const FOOTER_BANNER_IMAGE_LOADER = new InjectionToken<FooterBannerImageLoader>(
  'FOOTER_BANNER_IMAGE_LOADER',
  {
    providedIn: 'root',
    factory: () => (url: string) => new Promise<FooterBannerDimensions>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        } else {
          reject(new Error('Immagine senza dimensioni valide'));
        }
      };
      img.onerror = () => reject(new Error('Banner non disponibile'));
      img.src = url;
    })
  }
);

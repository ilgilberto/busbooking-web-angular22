import { InjectionToken } from '@angular/core';

/** Popup animata originale del branch funzione_filtra_fermate (Angular 13). */
export function noticeMessage(
  message: string, msDuration: number, color: string = 'red', postAction?: () => void
): void {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = '10000';
  overlay.style.padding = '2vh';
  overlay.style.boxSizing = 'border-box';

  const modal = document.createElement('div');
  modal.style.backgroundColor = 'white';
  modal.style.color = color;
  modal.style.padding = '2rem';
  modal.style.borderRadius = '1rem';
  modal.style.boxShadow = '0 0 2rem rgba(0,0,0,0.3)';
  modal.style.fontFamily = `'Comic Sans MS', cursive, sans-serif`;
  modal.style.fontSize = '7vw';
  modal.style.maxWidth = '90vw';
  modal.style.width = 'fit-content';
  modal.style.textAlign = 'center';
  modal.style.wordBreak = 'break-word';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.gap = '1rem';
  modal.style.position = 'relative';

  const logo = document.createElement('img');
  // Stessa risorsa logo della versione originale, visibile dietro al testo.
  logo.src = 'https://www.conoscenzacreativa.it/booksite/static/assets/img/LOGO.png';
  logo.alt = 'Logo';
  logo.style.height = '100%';
  logo.style.top = '0';
  logo.style.objectFit = 'contain';
  logo.style.alignSelf = 'flex-start';
  logo.style.zIndex = '1';
  logo.style.position = 'absolute';
  logo.style.left = '10%';
  logo.style.opacity = '0.3';
  modal.appendChild(logo);

  const textWrapper = document.createElement('div');
  textWrapper.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
  textWrapper.style.padding = '1rem';
  textWrapper.style.borderRadius = '0.5rem';
  textWrapper.style.zIndex = '2';
  for (const line of message.split('\n')) {
    const lineDiv = document.createElement('div');
    lineDiv.textContent = line;
    lineDiv.style.lineHeight = '1.4';
    textWrapper.appendChild(lineDiv);
  }
  modal.appendChild(textWrapper);

  modal.style.transform = 'scale(0.1)';
  modal.style.opacity = '0';
  modal.style.transition = 'transform 0.6s ease-out, opacity 0.6s ease-out';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      modal.style.transform = 'scale(1)';
      modal.style.opacity = '1';
    });
  });
  setTimeout(() => {
    overlay.remove();
    postAction?.();
  }, msDuration);
}

/** Indirezione DI per la popup: implementazione invariata in produzione, sostituibile nel TestBed. */
export const NOTICE_MESSAGE = new InjectionToken<typeof noticeMessage>('BusBookingNoticeMessage', {
  providedIn: 'root',
  factory: () => noticeMessage
});

/**
 * Riproduzione della schermata animata "Riferimento BOLOGNA" mostrata negli screenshot
 * della versione precedente. Non introduce nuovi servizi REST.
 */
const REFERENCE_CITIES = [
  { name: 'BOLOGNA', lat: 44.4949, lon: 11.3426 },
  { name: 'IMOLA', lat: 44.3530, lon: 11.7148 },
  { name: 'FERRARA', lat: 44.8381, lon: 11.6198 }
] as const;

function kmBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Non si attribuisce arbitrariamente una citta' a coordinate lontane dalle tre aree servite. */
export function getReferenceCity(latitude: number, longitude: number): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const nearest = REFERENCE_CITIES.map(city => ({
    name: city.name,
    km: kmBetween(latitude, longitude, city.lat, city.lon)
  })).sort((a, b) => a.km - b.km)[0];
  return nearest.km <= 23 ? nearest.name : null;
}

let currentSplash: HTMLElement | null = null;
let splashTimer: ReturnType<typeof setTimeout> | null = null;
let dismissCurrentSplash: (() => void) | null = null;

export function showReferenceSplash(city: string, duration = 2400): void {
  if (typeof document === 'undefined' || !city) return;
  dismissCurrentSplash?.();

  const overlay = document.createElement('div');
  overlay.className = 'bus-reference-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-label', `Riferimento ${city}`);

  const modal = document.createElement('div');
  modal.className = 'bus-reference-modal';

  const logo = document.createElement('img');
  logo.className = 'bus-reference-logo';
  logo.src = 'https://www.conoscenzacreativa.it/booksite/static/assets/img/LOGO.png';
  logo.alt = '';

  const headline = document.createElement('div');
  headline.className = 'bus-reference-text';
  for (const line of ['Riferimento', city]) {
    const row = document.createElement('div');
    row.textContent = line;
    headline.appendChild(row);
  }

  modal.append(logo, headline);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  currentSplash = overlay;

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (currentSplash === overlay) modal.classList.add('bus-reference-visible');
      });
    });
  } else {
    // Ambiente di test jsdom: requestAnimationFrame non sempre e' definita.
    modal.classList.add('bus-reference-visible');
  }

  const dismiss = () => {
    if (currentSplash !== overlay) return;
    overlay.remove();
    currentSplash = null;
    if (splashTimer !== null) clearTimeout(splashTimer);
    splashTimer = null;
    dismissCurrentSplash = null;
    document.removeEventListener('keydown', onKeyDown);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') dismiss();
  };
  overlay.addEventListener('click', dismiss);
  document.addEventListener('keydown', onKeyDown);
  dismissCurrentSplash = dismiss;
  splashTimer = setTimeout(dismiss, duration);
}

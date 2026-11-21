import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BannerFooterComponent } from './banner-footer.component';
import { FOOTER_BANNER_IMAGE_LOADER } from '../../utils/footer-banner-loader.token';

const imageSize = { width: 600, height: 80 };

function createLoaderMock() {
  return vi.fn((url: string): Promise<{width: number; height: number}> => {
    if (/imm[01]\.jpg$/.test(url)) return Promise.resolve(imageSize);
    return Promise.reject(new Error('File inesistente'));
  });
}

describe('BannerFooterComponent — sequenza promozionale', () => {
  let load: ReturnType<typeof createLoaderMock>;

  beforeEach(async () => {
    load = createLoaderMock();
    await TestBed.configureTestingModule({
      imports: [BannerFooterComponent],
      providers: [{ provide: FOOTER_BANNER_IMAGE_LOADER, useValue: load }]
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('non visualizza il footer se imm0.jpg non è caricabile', async () => {
    load.mockRejectedValue(new Error('imm0 non esiste'));
    const fixture = TestBed.createComponent(BannerFooterComponent);
    const emitted = vi.fn();
    fixture.componentInstance.availabilityChange.subscribe(emitted);
    fixture.detectChanges();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bus-banner-footer')).toBeNull();
    expect(emitted).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('carica imm0 e imm1 nell’ordine previsto, con lo spazio responsive gestito dal CSS', async () => {
    const fixture = TestBed.createComponent(BannerFooterComponent);
    const emitted = vi.fn();
    fixture.componentInstance.availabilityChange.subscribe(emitted);
    fixture.detectChanges();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(3));
    fixture.detectChanges();

    const calls = load.mock.calls.map(args => args[0]);
    expect(calls).toEqual([
      'https://conoscenzacreativa.it/banner/imm0.jpg',
      'https://conoscenzacreativa.it/banner/imm1.jpg',
      'https://conoscenzacreativa.it/banner/imm2.jpg'
    ]);
    expect(emitted).toHaveBeenCalledTimes(1);
    expect(emitted).toHaveBeenCalledWith(true);
    const images: HTMLImageElement[] = Array.from(fixture.nativeElement.querySelectorAll('img.bus-banner-image'));
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute('src')).toContain('imm0.jpg');
    expect(images[1].getAttribute('src')).toContain('imm1.jpg');
    // La flex strip mantiene imm0 in testa e imm1 alla sua destra, separati dal gap responsive CSS.
    expect(fixture.nativeElement.querySelector('.bus-banner-strip')).not.toBeNull();
    fixture.destroy();
  });

  it('apre il collegamento configurato in una nuova scheda in modo sicuro', async () => {
    const fixture = TestBed.createComponent(BannerFooterComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.visible).toBe(true));
    fixture.detectChanges();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a.bus-banner-strip');
    expect(link.getAttribute('href')).toBe('https://conoscenzacreativa.it/mondodilibri');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');
    fixture.destroy();
  });


  it('mostra un unico banner quando imm1 non esiste, senza richiedere imm2', async () => {
    load.mockImplementation(url => url.endsWith('imm0.jpg')
      ? Promise.resolve(imageSize) : Promise.reject(new Error('404')));

    const fixture = TestBed.createComponent(BannerFooterComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(fixture.componentInstance.banners).toHaveLength(1));
    fixture.detectChanges();

    expect(fixture.componentInstance.visible).toBe(true);
    expect(load.mock.calls.map(args => args[0])).toEqual([
      'https://conoscenzacreativa.it/banner/imm0.jpg',
      'https://conoscenzacreativa.it/banner/imm1.jpg'
    ]);
    expect(fixture.nativeElement.querySelectorAll('img.bus-banner-image')).toHaveLength(1);
    fixture.destroy();
  });

  it('mantiene le proporzioni originali e non altera ordine o URL delle immagini', async () => {
    load.mockImplementation(url => {
      if (url.endsWith('imm0.jpg')) return Promise.resolve({ width: 600, height: 80 });
      if (url.endsWith('imm1.jpg')) return Promise.resolve({ width: 900, height: 120 });
      return Promise.reject(new Error('404'));
    });

    const fixture = TestBed.createComponent(BannerFooterComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.banners).toHaveLength(2));
    fixture.detectChanges();
    const images = Array.from(fixture.nativeElement.querySelectorAll('img.bus-banner-image')) as HTMLImageElement[];
    expect(images.map(img => img.getAttribute('width'))).toEqual(['600', '900']);
    expect(images.map(img => img.getAttribute('height'))).toEqual(['80', '120']);
    expect(images.map(img => img.getAttribute('src')?.split('/').pop())).toEqual(['imm0.jpg', 'imm1.jpg']);
    fixture.destroy();
  });

  it('non mostra un banner con dimensioni intrinseche non valide', async () => {
    load.mockResolvedValue({ width: 0, height: 80 });
    const fixture = TestBed.createComponent(BannerFooterComponent);
    const availability = vi.fn();
    fixture.componentInstance.availabilityChange.subscribe(availability);
    fixture.detectChanges();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.componentInstance.visible).toBe(false);
    expect(fixture.componentInstance.banners).toHaveLength(0);
    expect(availability).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('interrompe la scansione alla prima immagine mancante anche dopo più banner', async () => {
    load.mockImplementation(url => /imm[012]\.jpg$/.test(url)
      ? Promise.resolve(imageSize) : Promise.reject(new Error('404')));
    const fixture = TestBed.createComponent(BannerFooterComponent);
    const availability = vi.fn();
    fixture.componentInstance.availabilityChange.subscribe(availability);
    fixture.detectChanges();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(4));
    await vi.waitFor(() => expect(fixture.componentInstance.banners).toHaveLength(3));
    expect(load.mock.calls.map(call => call[0].split('/').pop())).toEqual([
      'imm0.jpg', 'imm1.jpg', 'imm2.jpg', 'imm3.jpg'
    ]);
    expect(availability).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('sospende lo scorrimento con mouse e tastiera e lo riprende quando si esce', async () => {
    const fixture = TestBed.createComponent(BannerFooterComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.visible).toBe(true));
    fixture.detectChanges();
    const strip: HTMLAnchorElement = fixture.nativeElement.querySelector('a.bus-banner-strip');

    strip.dispatchEvent(new Event('mouseenter'));
    expect(fixture.componentInstance.paused).toBe(true);
    strip.dispatchEvent(new Event('mouseleave'));
    expect(fixture.componentInstance.paused).toBe(false);
    strip.dispatchEvent(new Event('focus'));
    expect(fixture.componentInstance.paused).toBe(true);
    strip.dispatchEvent(new Event('blur'));
    expect(fixture.componentInstance.paused).toBe(false);
    fixture.destroy();
  });

  it('rispetta la preferenza di movimento ridotto, nascondendo gli altri banner', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const fixture = TestBed.createComponent(BannerFooterComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.banners).toHaveLength(2));
    fixture.detectChanges();
    expect(fixture.componentInstance.reducedMotion).toBe(true);
    expect(fixture.nativeElement.querySelector('.bus-banner-footer--reduced-motion')).not.toBeNull();
    const images = fixture.nativeElement.querySelectorAll('img.bus-banner-image');
    expect(images[0].classList.contains('bus-banner-image--reduced-hidden')).toBe(false);
    expect(images[1].classList.contains('bus-banner-image--reduced-hidden')).toBe(true);
    fixture.destroy();
  });

  it('ignora la risposta di una richiesta immagine ancora pendente dopo la distruzione', async () => {
    let finishLoad!: (dimensions: { width: number; height: number }) => void;
    load.mockImplementation(() => new Promise(resolve => { finishLoad = resolve; }));
    const fixture = TestBed.createComponent(BannerFooterComponent);
    const availability = vi.fn();
    fixture.componentInstance.availabilityChange.subscribe(availability);
    fixture.detectChanges();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    fixture.destroy();
    finishLoad(imageSize);
    await Promise.resolve();
    await Promise.resolve();
    expect(availability).not.toHaveBeenCalled();
    expect(fixture.componentInstance.banners).toHaveLength(0);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('annulla la richiesta di animazione quando il componente viene distrutto', async () => {
    const supportsAnimation = typeof window.requestAnimationFrame === 'function' &&
      typeof window.cancelAnimationFrame === 'function';
    const cancel = supportsAnimation ? vi.spyOn(window, 'cancelAnimationFrame') : null;
    const fixture = TestBed.createComponent(BannerFooterComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.visible).toBe(true));
    fixture.detectChanges();
    fixture.destroy();
    if (supportsAnimation) expect(cancel).toHaveBeenCalled();
  });
});

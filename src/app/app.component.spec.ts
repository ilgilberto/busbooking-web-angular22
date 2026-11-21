import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { AppComponent } from './app.component';
import { BannerFooterComponent } from './components/banner-footer/banner-footer.component';
import { FOOTER_BANNER_IMAGE_LOADER } from './utils/footer-banner-loader.token';

// Nessun accesso alla rete esterna durante i test del componente root.
describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: FOOTER_BANNER_IMAGE_LOADER, useValue: () => Promise.reject(new Error('non disponibile')) }
      ]
    }).compileComponents();
  });

  it('crea il componente principale con un router outlet e un footer condiviso da tutte le pagine', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.title).toBe('bus-booking-web');
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-banner-footer')).not.toBeNull();

    // Il footer riserva spazio in fondo soltanto se imm0 è stata caricata.
    const layout = fixture.nativeElement.querySelector('.bus-app-layout');
    expect(layout.classList.contains('bus-app-layout--with-footer')).toBe(false);
    const footer = fixture.debugElement.query(By.directive(BannerFooterComponent));
    expect(footer).toBeDefined();
    (footer!.componentInstance as BannerFooterComponent).availabilityChange.emit(true);
    fixture.detectChanges();
    expect(layout.classList.contains('bus-app-layout--with-footer')).toBe(true);
    fixture.destroy();
  });
});

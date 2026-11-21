import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BannerFooterComponent } from './components/banner-footer/banner-footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, BannerFooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  readonly title = 'bus-booking-web';
  bannerVisible = false;
  private readonly changeDetector = inject(ChangeDetectorRef);

  onBannerAvailabilityChange(visible: boolean): void {
    this.bannerVisible = visible;
    this.changeDetector.markForCheck();
  }
}

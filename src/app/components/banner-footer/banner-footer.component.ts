import {
  AfterViewChecked,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  FOOTER_BANNER_IMAGE_LOADER,
  FooterBannerImageLoader
} from '../../utils/footer-banner-loader.token';
import { advanceFooterBannerOffset } from '../../utils/footer-banner-motion.util';

interface LoadedBanner {
  index: number;
  url: string;
  width: number;
  height: number;
}

@Component({
  selector: 'app-banner-footer',
  standalone: true,
  templateUrl: './banner-footer.component.html',
  styleUrl: './banner-footer.component.scss'
})
export class BannerFooterComponent implements OnInit, AfterViewChecked, OnDestroy {
  @Output() readonly availabilityChange = new EventEmitter<boolean>();
  @ViewChild('bannerViewport') private viewport?: ElementRef<HTMLElement>;
  @ViewChild('bannerStrip') private strip?: ElementRef<HTMLAnchorElement>;

  private readonly loadImage: FooterBannerImageLoader = inject(FOOTER_BANNER_IMAGE_LOADER);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  /** La prima immagine è condizione necessaria per visualizzare il footer. */
  visible = false;
  readonly banners: LoadedBanner[] = [];
  readonly destinationUrl = environment.footerBannerDestinationUrl;
  readonly reducedMotion = typeof window === 'undefined' ||
    typeof requestAnimationFrame !== 'function' ||
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  paused = false;

  private destroyed = false;
  private sequenceComplete = false;
  private frameId: number | null = null;
  private frameStarted = false;
  private lastFrameTimestamp: number | null = null;
  private bannerStripOffsetPx = 0;

  private readonly speedPxPerSecond = environment.footerBannerSpeedPxPerSecond;
  private readonly emptyGapPx = 48;
  // Protezione contro endpoint erronei che restituiscono un'immagine per qualunque nome.
  private readonly maxImages = 100;

  ngOnInit(): void {
    void this.discoverImages();
  }

  ngAfterViewChecked(): void {
    if (this.visible && !this.reducedMotion && !this.frameStarted &&
        this.viewport && this.strip && typeof requestAnimationFrame === 'function') {
      this.frameStarted = true;
      this.zone.runOutsideAngular(() => {
        this.frameId = requestAnimationFrame(this.animate);
      });
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.frameId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.frameId);
    }
  }

  private async discoverImages(): Promise<void> {
    const prefix = environment.footerBannerImageUrlPrefix;
    // Una sola scansione; il ciclo visivo successivo riusa le immagini caricate.
    for (let index = 0; index < this.maxImages && !this.destroyed; index++) {
      const url = `${prefix}${index}.jpg`;
      try {
        const dimensions = await this.loadImage(url);
        if (this.destroyed) return;
        if (!(dimensions.width > 0 && dimensions.height > 0)) break;
        this.banners.push({ index, url, width: dimensions.width, height: dimensions.height });
        if (index === 0) {
          this.visible = true;
          this.availabilityChange.emit(true);
        }
        this.changeDetector.markForCheck();
      } catch {
        // Il primo file inesistente (imm0 incluso) termina la ricerca.
        break;
      }
    }
    this.sequenceComplete = true;
    this.changeDetector.markForCheck();
  }

  private readonly animate = (timestamp: number): void => {
    if (this.destroyed || !this.viewport || !this.strip) return;
    const container = this.viewport.nativeElement;
    const train = this.strip.nativeElement;

    if (this.lastFrameTimestamp !== null && !this.paused) {
      // Evita salti quando si ritorna a una scheda rimasta nascosta a lungo.
      const elapsedMs = Math.max(0, Math.min(timestamp - this.lastFrameTimestamp, 100));
      this.bannerStripOffsetPx = advanceFooterBannerOffset(
        this.bannerStripOffsetPx,
        elapsedMs,
        this.speedPxPerSecond,
        train.offsetWidth,
        container.clientWidth,
        this.emptyGapPx,
        this.sequenceComplete
      );
    }
    this.lastFrameTimestamp = timestamp;
    train.style.transform = `translate3d(${this.bannerStripOffsetPx}px, 0, 0)`;
    this.frameId = requestAnimationFrame(this.animate);
  };
}

import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [NgIf, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss'
})
export class WelcomeComponent implements OnInit {
  error: string | null = null;
  loading = false;
  isAndroid = false;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.isAndroid = /android/i.test(navigator.userAgent) || /google/i.test(navigator.userAgent);
  }

  requestLocation(): void {
    this.error = null;
    this.loading = true;
    if (!navigator.geolocation) {
      this.error = 'Geolocalizzazione non supportata.';
      this.loading = false;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        this.loading = false;
        // La popup "Riferimento <comune>" e' mostrata dopo GET /comune,
        // NON stimando la citta' in base alle coordinate come nella v1.4.
        void this.router.navigate(['/stops']);
      },
      () => {
        this.loading = false;
        this.error = 'Permesso posizione negato.';
      }
    );
  }

  goToConoscenzaCreativa(): void {
    window.open('https://www.conoscenzacreativa.it/booksite', '_blank', 'noopener,noreferrer');
  }
}

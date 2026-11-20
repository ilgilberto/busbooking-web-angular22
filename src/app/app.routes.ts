import { Routes } from '@angular/router';
import { NearbyStopsComponent } from './components/nearby-stops/nearby-stops.component';
import { StopDetailsComponent } from './components/stop-details/stop-details.component';
import { WelcomeComponent } from './components/welcome/welcome.component';

// Percorsi invariati rispetto alla precedente versione Angular 13.
export const appRoutes: Routes = [
  { path: '', component: WelcomeComponent },
  { path: 'stops', component: NearbyStopsComponent },
  { path: 'stop', component: StopDetailsComponent },
  { path: '**', redirectTo: '' }
];

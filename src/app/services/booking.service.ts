import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private activeAssistance = new Subject<string>();
  assistance$ = this.activeAssistance.asObservable();

  notifyAssistance(id: string): void {
    this.activeAssistance.next(id);
  }
}
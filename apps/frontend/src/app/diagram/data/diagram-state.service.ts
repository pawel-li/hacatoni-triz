import { Injectable, signal } from '@angular/core';
import { SolutionPopupData } from '../data/types';

@Injectable()
export class DiagramStateService {
  readonly activePopup = signal<SolutionPopupData | null>(null);

  openPopup(data: SolutionPopupData): void {
    this.activePopup.set(data);
  }

  closePopup(): void {
    this.activePopup.set(null);
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  inject,
  effect,
  signal,
} from '@angular/core';
import { DiagramStateService } from '../../data/diagram-state.service';

@Component({
  selector: 'app-solution-popup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (diagramState.activePopup(); as popup) {
      <div
        class="overlay"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Solution for ' + popup.label"
        (click)="onBackdropClick($event)"
      >
        <div class="popup" (click)="$event.stopPropagation()">
          <!-- Score ring -->
          <div
            class="popup__score-wrap"
            [attr.aria-label]="'Score: ' + popup.score + ' out of 100'"
          >
            <svg
              class="popup__ring"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              <circle class="popup__ring-bg" cx="50" cy="50" r="42" />
              <circle
                class="popup__ring-fill"
                cx="50"
                cy="50"
                r="42"
                [style.stroke-dashoffset]="dashOffset()"
              />
            </svg>
            <span class="popup__score-num" aria-live="polite">{{ animatedScore() }}</span>
          </div>

          <div class="popup__badge">TRIZ SOLUTION</div>
          <h3 class="popup__label">{{ popup.label }}</h3>
          <p class="popup__solution">{{ popup.solution }}</p>

          <button
            class="popup__close"
            (click)="diagramState.closePopup()"
            aria-label="Close solution popup"
            type="button"
          >
            ✕ Close
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(10, 12, 11, 0.82);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: overlayIn 0.25s ease both;
    }

    .popup {
      background: #f4f2e8;
      border: 2px dotted #111312;
      border-radius: 4px;
      padding: 36px 36px 28px;
      max-width: 380px;
      width: 90vw;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 32px 80px rgb(0 0 0 / 70%);
      animation: popupIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    .popup__score-wrap {
      position: relative;
      width: 120px;
      height: 120px;
      margin-bottom: 24px;
    }

    .popup__ring {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .popup__ring-bg {
      fill: none;
      stroke: rgba(17, 19, 18, 0.1);
      stroke-width: 8;
    }

    .popup__ring-fill {
      fill: none;
      stroke: #2f85b6;
      stroke-width: 8;
      stroke-linecap: round;
      stroke-dasharray: 263.9;
      transition: stroke-dashoffset 1.4s cubic-bezier(0.25, 1, 0.5, 1);
    }

    .popup__score-num {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Russo One', sans-serif;
      font-size: 2rem;
      color: #111312;
    }

    .popup__badge {
      display: inline-block;
      background: #111312;
      color: #f4f2e8;
      font-family: 'Russo One', sans-serif;
      font-size: 0.6rem;
      letter-spacing: 0.18em;
      padding: 3px 12px;
      border-radius: 2px;
      margin-bottom: 10px;
    }

    .popup__label {
      font-family: 'Russo One', sans-serif;
      font-size: 1.05rem;
      color: #111312;
      margin: 0 0 12px;
      text-align: center;
    }

    .popup__solution {
      font-family: 'Inter', sans-serif;
      font-size: 0.9rem;
      color: #5d625d;
      line-height: 1.55;
      margin: 0 0 24px;
      text-align: center;
    }

    .popup__close {
      background: transparent;
      border: 1.5px solid rgba(17, 19, 18, 0.3);
      color: #111312;
      border-radius: 2px;
      padding: 8px 22px;
      font-family: 'Inter', sans-serif;
      font-size: 0.82rem;
      cursor: pointer;
      transition: background 0.2s, color 0.2s, border-color 0.2s;
    }

    .popup__close:hover {
      background: #111312;
      color: #f4f2e8;
      border-color: #111312;
    }

    @keyframes overlayIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes popupIn {
      from {
        opacity: 0;
        transform: scale(0.8) translateY(24px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
  `,
})
export class SolutionPopupComponent {
  readonly diagramState = inject(DiagramStateService);

  readonly animatedScore = signal(0);
  readonly dashOffset = signal(263.9);

  private animationFrame: number | null = null;

  constructor() {
    effect(() => {
      const popup = this.diagramState.activePopup();
      if (popup) {
        this.startScoreAnimation(popup.score);
      } else {
        this.animatedScore.set(0);
        this.dashOffset.set(263.9);
      }
    });
  }

  private startScoreAnimation(targetScore: number): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.animatedScore.set(0);
    this.dashOffset.set(263.9);

    const duration = 1400;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      const current = Math.round(eased * targetScore);
      this.animatedScore.set(current);
      this.dashOffset.set(263.9 * (1 - eased * (targetScore / 100)));

      if (elapsed < 1) {
        this.animationFrame = requestAnimationFrame(tick);
      }
    };

    setTimeout(() => {
      this.animationFrame = requestAnimationFrame(tick);
    }, 150);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('overlay')) {
      this.diagramState.closePopup();
    }
  }
}

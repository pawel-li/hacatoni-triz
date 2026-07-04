import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgDiagramPortComponent } from 'ng-diagram';
import type { Node } from 'ng-diagram';

export type RunCardVariant =
  | 'spine'
  | 'mechanism'
  | 'candidate'
  | 'best'
  | 'terminal';

export type RunCardNodeData = {
  stage: string;
  title: string;
  subtitle: string;
  detail?: string;
  meta?: string;
  badge?: string;
  variant: RunCardVariant;
};

@Component({
  selector: 'app-run-card-node',
  imports: [NgDiagramPortComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article [class]="'run-card run-card--' + node().data.variant" role="article">
      <ng-diagram-port id="port-top" side="top" type="target" />
      @if (node().data.variant === 'best') {
        <span class="run-card__star" aria-hidden="true">★</span>
      }
      <div class="run-card__header-row">
        <p class="run-card__stage">{{ node().data.stage }}</p>
        @if (node().data.badge) {
          <span class="run-card__badge">{{ node().data.badge }}</span>
        }
      </div>
      <h3 class="run-card__title">{{ node().data.title }}</h3>
      <p class="run-card__subtitle">{{ node().data.subtitle }}</p>
      @if (node().data.detail) {
        <p class="run-card__detail">{{ node().data.detail }}</p>
      }
      @if (node().data.meta) {
        <p class="run-card__meta">{{ node().data.meta }}</p>
      }
      <ng-diagram-port id="port-bottom" side="bottom" type="source" />
    </article>
  `,
  styles: `
    :host {
      display: block;
    }

    .run-card {
      width: 360px;
      border: 2px solid #111312;
      background: #f4f2e8;
      color: #111312;
      padding: 20px 22px 18px;
      position: relative;
      box-shadow: 0 18px 42px rgb(0 0 0 / 42%);
      animation: cardEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    .run-card::before {
      content: '';
      position: absolute;
      inset: 6px;
      border: 1px solid rgb(17 19 18 / 12%);
      pointer-events: none;
    }

    .run-card--mechanism {
      background: #efe8da;
    }

    .run-card--candidate {
      background: #edf4e7;
      border-color: #1d3b2b;
    }

    .run-card--best {
      background: #f7e2a0;
      border: 2px solid #7d5911;
      box-shadow:
        0 0 0 4px rgb(239 232 218 / 22%),
        0 18px 44px rgb(0 0 0 / 45%);
    }

    .run-card--best .run-card__badge {
      background: #7d5911;
      border-color: #7d5911;
      color: #fff8dc;
    }

    .run-card__star {
      position: absolute;
      top: -18px;
      right: -14px;
      font-size: 2rem;
      line-height: 1;
      color: #d4a017;
      text-shadow: 0 2px 6px rgb(0 0 0 / 35%);
      animation: starPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    .run-card--terminal {
      background: #e4edf0;
      border-color: #263f4a;
    }

    .run-card__header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 2px solid rgb(17 19 18 / 16%);
      padding-bottom: 10px;
    }

    .run-card__stage,
    .run-card__badge {
      margin: 0;
      font-size: 0.67rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgb(17 19 18 / 58%);
    }

    .run-card__stage {
      font-family: 'Russo One', sans-serif;
      color: rgb(17 19 18 / 72%);
    }

    .run-card__badge {
      border: 1.5px solid rgb(17 19 18 / 55%);
      background: #111312;
      color: #f4f2e8;
      padding: 3px 8px;
      white-space: nowrap;
    }

    .run-card__title {
      margin: 14px 0 0;
      font-family: 'Russo One', sans-serif;
      font-size: 1.06rem;
      line-height: 1.28;
    }

    .run-card__subtitle,
    .run-card__detail,
    .run-card__meta {
      margin: 10px 0 0;
      font-size: 0.86rem;
      line-height: 1.5;
      color: rgb(17 19 18 / 78%);
    }

    .run-card__detail {
      max-height: 6.6em;
      overflow: auto;
      white-space: pre-line;
      border-left: 2px solid rgb(17 19 18 / 28%);
      padding-left: 12px;
      color: #111312;
    }

    .run-card__meta {
      border-top: 1px solid rgb(17 19 18 / 14%);
      padding-top: 10px;
      font-weight: 700;
      color: rgb(17 19 18 / 62%);
    }

    @keyframes cardEnter {
      from {
        opacity: 0;
        transform: translateY(-14px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes starPop {
      from {
        opacity: 0;
        transform: scale(0.3) rotate(-30deg);
      }
      to {
        opacity: 1;
        transform: scale(1) rotate(0deg);
      }
    }
  `,
})
export class RunCardNodeComponent {
  node = input.required<Node<RunCardNodeData>>();
}

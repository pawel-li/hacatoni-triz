import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgDiagramPortComponent } from 'ng-diagram';
import type { Node } from 'ng-diagram';

export type RunCardVariant = 'spine' | 'mechanism' | 'candidate' | 'terminal';

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
    <article class="run-card" [class]="'run-card--' + node().data.variant" role="article">
      <ng-diagram-port id="port-top" side="top" type="target" />
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
      width: 340px;
      border: 1px dotted rgb(17 19 18 / 75%);
      background: #f4f2e8;
      color: #111312;
      padding: 18px 20px;
      position: relative;
      box-shadow: 0 18px 34px rgb(0 0 0 / 38%);
      animation: cardEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    .run-card--mechanism {
      background: #f7efd0;
    }

    .run-card--candidate {
      background: #e7f0e2;
    }

    .run-card--terminal {
      background: #dfe8f0;
    }

    .run-card__header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
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

    .run-card__badge {
      border: 1px dotted rgb(17 19 18 / 45%);
      padding: 2px 7px;
      white-space: nowrap;
    }

    .run-card__title {
      margin: 8px 0 0;
      font-family: 'Russo One', sans-serif;
      font-size: 1rem;
      line-height: 1.3;
    }

    .run-card__subtitle,
    .run-card__detail,
    .run-card__meta {
      margin: 8px 0 0;
      font-size: 0.84rem;
      line-height: 1.45;
      color: rgb(17 19 18 / 72%);
    }

    .run-card__detail {
      max-height: 6.6em;
      overflow: auto;
      white-space: pre-line;
      color: rgb(17 19 18 / 82%);
    }

    .run-card__meta {
      font-weight: 700;
      color: rgb(17 19 18 / 55%);
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
  `,
})
export class RunCardNodeComponent {
  node = input.required<Node<RunCardNodeData>>();
}

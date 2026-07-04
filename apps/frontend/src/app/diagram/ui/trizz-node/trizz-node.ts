import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { NgDiagramPortComponent } from 'ng-diagram';
import type { Node } from 'ng-diagram';
import { TrizzNodeData } from '../../data/types';
import { DiagramStateService } from '../../data/diagram-state.service';

@Component({
  selector: 'app-trizz-node',
  imports: [NgDiagramPortComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="trizz-node"
      role="article"
      [attr.aria-label]="node().data.label"
    >
      <ng-diagram-port id="port-top" side="top" type="target" />

      <div class="trizz-node__header">
        <span class="trizz-node__num">0{{ node().data.index }}</span>
        <span class="trizz-node__label">{{ node().data.label }}</span>
      </div>

      <div class="trizz-node__row">
        <span class="trizz-node__tag trizz-node__tag--if">IF</span>
        <span class="trizz-node__text">{{ node().data.if }}</span>
      </div>
      <div class="trizz-node__divider"></div>
      <div class="trizz-node__row">
        <span class="trizz-node__tag trizz-node__tag--then">THEN</span>
        <span class="trizz-node__text">{{ node().data.then }}</span>
      </div>
      <div class="trizz-node__divider"></div>
      <div class="trizz-node__row">
        <span class="trizz-node__tag trizz-node__tag--but">BUT</span>
        <span class="trizz-node__text">{{ node().data.but }}</span>
      </div>

      <button
        class="trizz-node__btn"
        (click)="onViewSolution()"
        [attr.aria-label]="'View solution for ' + node().data.label"
        type="button"
      >
        View Solution →
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .trizz-node {
      background: #f4f2e8;
      border: 2px solid #111312;
      padding: 22px 22px 18px;
      min-width: 240px;
      max-width: 270px;
      position: relative;
      box-shadow: 0 18px 42px rgb(0 0 0 / 42%);
      animation: nodeEnter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    .trizz-node::before {
      content: '';
      position: absolute;
      inset: 6px;
      border: 1px solid rgb(17 19 18 / 12%);
      pointer-events: none;
    }

    .trizz-node__header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      border-bottom: 2px solid rgb(17 19 18 / 16%);
      padding-bottom: 10px;
    }

    .trizz-node__num {
      font-family: 'Russo One', sans-serif;
      font-size: 1.5rem;
      color: rgba(17, 19, 18, 0.28);
      line-height: 1;
    }

    .trizz-node__label {
      font-family: 'Russo One', sans-serif;
      font-size: 0.7rem;
      color: #111312;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .trizz-node__row {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 7px 0;
    }

    .trizz-node__tag {
      font-family: 'Russo One', sans-serif;
      font-size: 0.55rem;
      letter-spacing: 0.1em;
      padding: 4px 8px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .trizz-node__tag--if {
      background: #2f85b6;
      color: #f4f2e8;
    }

    .trizz-node__tag--then {
      background: #4a7c59;
      color: #f4f2e8;
    }

    .trizz-node__tag--but {
      background: #8b3a3a;
      color: #f4f2e8;
    }

    .trizz-node__text {
      font-family: 'Inter', sans-serif;
      font-size: 0.8rem;
      color: #111312;
      line-height: 1.5;
    }

    .trizz-node__divider {
      height: 1px;
      background: rgba(17, 19, 18, 0.1);
    }

    .trizz-node__btn {
      margin-top: 16px;
      width: 100%;
      background: #111312;
      color: #f4f2e8;
      border: 2px solid #111312;
      padding: 10px 14px;
      font-family: 'Russo One', sans-serif;
      font-size: 0.72rem;
      letter-spacing: 0.07em;
      cursor: pointer;
      transition: background 0.2s, transform 0.15s;
    }

    .trizz-node__btn:hover {
      background: #f4f2e8;
      color: #111312;
      transform: translateY(-1px);
    }

    .trizz-node__btn:focus-visible {
      outline: 3px solid rgb(17 19 18 / 35%);
      outline-offset: 3px;
    }

    .trizz-node__btn:active {
      transform: translateY(0);
    }

    @keyframes nodeEnter {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.94);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `,
})
export class TrizzNodeComponent {
  node = input.required<Node<TrizzNodeData>>();

  private readonly diagramState = inject(DiagramStateService);

  onViewSolution(): void {
    this.diagramState.openPopup({
      nodeId: this.node().id,
      solution: this.node().data.solution,
      score: this.node().data.score,
      label: this.node().data.label,
    });
  }
}

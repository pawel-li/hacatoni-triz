import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { NgDiagramPortComponent } from 'ng-diagram';
import type { Node } from 'ng-diagram';
import { PromptNodeData } from '../../data/types';

@Component({
  selector: 'app-prompt-node',
  imports: [NgDiagramPortComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="prompt-node" role="article" aria-label="Problem prompt">
      <div class="prompt-node__badge">PROMPT</div>
      <h2 class="prompt-node__title">{{ node().data.label }}</h2>
      <p class="prompt-node__subtitle">{{ node().data.subtitle }}</p>
      <ng-diagram-port id="port-bottom" side="bottom" type="source" />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .prompt-node {
      background: #f4f2e8;
      border: 2px dotted #111312;
      border-radius: 4px;
      padding: 24px 28px;
      min-width: 340px;
      max-width: 420px;
      position: relative;
      box-shadow: 0 18px 42px rgb(0 0 0 / 60%);
      animation: nodeEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    .prompt-node__badge {
      display: inline-block;
      background: #111312;
      color: #f4f2e8;
      font-family: 'Russo One', sans-serif;
      font-size: 0.65rem;
      letter-spacing: 0.15em;
      padding: 3px 10px;
      border-radius: 2px;
      margin-bottom: 12px;
    }

    .prompt-node__title {
      font-family: 'Russo One', sans-serif;
      font-size: 1.05rem;
      color: #111312;
      margin: 0 0 8px;
      line-height: 1.3;
    }

    .prompt-node__subtitle {
      font-family: 'Inter', sans-serif;
      font-size: 0.85rem;
      color: #5d625d;
      margin: 0;
      line-height: 1.4;
    }

    @keyframes nodeEnter {
      from {
        opacity: 0;
        transform: translateY(-16px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `,
})
export class PromptNodeComponent {
  node = input.required<Node<PromptNodeData>>();
}

import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import {
  NgDiagramComponent,
  NgDiagramNodeTemplateMap,
  initializeModel,
  provideNgDiagram,
} from 'ng-diagram';
import { RouterModule } from '@angular/router';
import { PromptNodeComponent } from '../prompt-node/prompt-node';
import { TrizzNodeComponent } from '../trizz-node/trizz-node';
import { SolutionPopupComponent } from '../solution-popup/solution-popup';
import { DiagramStateService } from '../../data/diagram-state.service';

@Component({
  selector: 'app-diagram-page',
  imports: [NgDiagramComponent, SolutionPopupComponent, RouterModule],
  providers: [provideNgDiagram(), DiagramStateService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page" aria-label="TRIZ Diagram">
      <!-- Header -->
      <header class="page__header">
        <a routerLink="/" class="page__back" aria-label="Back to home">← Back</a>
        <div class="page__title-wrap">
          <h1 class="page__title font-soviet">TRIZZER</h1>
          <p class="page__tagline font-inter">Diagram view — explore your TRIZ solution paths</p>
        </div>
      </header>

      <!-- Diagram canvas -->
      <div class="page__canvas" role="region" aria-label="TRIZ flow diagram">
        <ng-diagram
          [model]="model"
          [nodeTemplateMap]="nodeTemplateMap"
        />
      </div>

      <!-- Solution popup -->
      <app-solution-popup />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      overflow: hidden;
      background: #0f1110;
    }

    .page {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .page__header {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 20px 28px 16px;
      border-bottom: 1px solid rgba(244, 242, 232, 0.08);
      flex-shrink: 0;
    }

    .page__back {
      color: rgba(244, 242, 232, 0.45);
      font-family: 'Inter', sans-serif;
      font-size: 0.8rem;
      text-decoration: none;
      transition: color 0.2s;
      white-space: nowrap;
    }

    .page__back:hover {
      color: #f4f2e8;
    }

    .page__title-wrap {
      display: flex;
      align-items: baseline;
      gap: 14px;
      flex-wrap: wrap;
    }

    .page__title {
      font-family: 'Russo One', sans-serif;
      font-size: clamp(1.4rem, 4vw, 2rem);
      color: #f4f2e8;
      margin: 0;
      line-height: 1;
      letter-spacing: 0.04em;
    }

    .page__tagline {
      font-family: 'Inter', sans-serif;
      font-size: 0.82rem;
      color: rgba(244, 242, 232, 0.4);
      margin: 0;
    }

    .page__canvas {
      flex: 1;
      min-height: 0;
      display: flex;
    }

    .page__canvas ng-diagram {
      flex: 1;
    }
  `,
})
export class DiagramPageComponent {
  readonly nodeTemplateMap = new NgDiagramNodeTemplateMap([
    ['prompt', PromptNodeComponent],
    ['trizz', TrizzNodeComponent],
  ]);

  readonly model = initializeModel({
    nodes: [
      // Prompt node at the top center
      {
        id: 'prompt',
        type: 'prompt',
        position: { x: 280, y: 60 },
        data: {
          label: 'Lorem ipsum prompt: How might we eliminate creative blocks using systematic innovation?',
          subtitle: 'Analysed via TRIZ — 3 contradiction paths identified',
        },
        draggable: true,
      },
      // TRIZ node 1
      {
        id: 'trizz-1',
        type: 'trizz',
        position: { x: 30, y: 340 },
        data: {
          index: 1,
          label: 'Physical Contradiction',
          if: 'The material must be rigid to support load',
          then: 'The material is strong and reliable',
          but: 'It cannot flex and breaks under vibration',
          solution: 'Apply the TRIZ principle of Segmentation — divide the material into small, flexible segments joined by elastic connectors so it is locally rigid but globally flexible.',
          score: 87,
        },
        draggable: true,
      },
      // TRIZ node 2
      {
        id: 'trizz-2',
        type: 'trizz',
        position: { x: 340, y: 340 },
        data: {
          index: 2,
          label: 'Technical Contradiction',
          if: 'We speed up the production line',
          then: 'Output throughput increases significantly',
          but: 'Product quality degrades due to less inspection time',
          solution: 'Use the TRIZ principle of Preliminary Action — pre-sort and pre-inspect raw materials automatically before they enter the line so speed and quality are decoupled.',
          score: 74,
        },
        draggable: true,
      },
      // TRIZ node 3
      {
        id: 'trizz-3',
        type: 'trizz',
        position: { x: 650, y: 340 },
        data: {
          index: 3,
          label: 'Inventive Problem',
          if: 'We add more sensors to the system',
          then: 'Measurement accuracy improves',
          but: 'The system becomes too complex and costly to maintain',
          solution: 'Employ the TRIZ principle of Trimming — remove redundant sensors and achieve the same accuracy through software fusion of fewer high-quality inputs.',
          score: 92,
        },
        draggable: true,
      },
    ],
    edges: [
      {
        id: 'e-prompt-1',
        source: 'prompt',
        sourcePort: 'port-bottom',
        target: 'trizz-1',
        targetPort: 'port-top',
        routing: 'bezier',
        data: {},
      },
      {
        id: 'e-prompt-2',
        source: 'prompt',
        sourcePort: 'port-bottom',
        target: 'trizz-2',
        targetPort: 'port-top',
        routing: 'bezier',
        data: {},
      },
      {
        id: 'e-prompt-3',
        source: 'prompt',
        sourcePort: 'port-bottom',
        target: 'trizz-3',
        targetPort: 'port-top',
        routing: 'curved',
        data: {},
      },
    ],
  });
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  NgDiagramComponent,
  NgDiagramNodeTemplateMap,
  initializeModel,
  provideNgDiagram,
} from 'ng-diagram';
import type { Edge, ModelAdapter, Node } from 'ng-diagram';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { PromptNodeComponent } from '../../../diagram/ui/prompt-node/prompt-node';
import { PromptApiService } from '../../data/prompt-api.service';
import { Prompt, PromptRunEvent } from '../../data/types';

type DiagramNode = Node<{ label: string; subtitle: string }>;

type PromptPageState = {
  loading: boolean;
  error: string | null;
  prompt: Prompt | null;
};

@Component({
  selector: 'app-prompt-diagram-page',
  imports: [RouterModule, NgDiagramComponent],
  providers: [provideNgDiagram()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      class="flex min-h-dvh flex-col bg-[#0f1110] px-5 pb-6 pt-4 text-[#efe8da] sm:px-8"
      aria-label="Prompt page"
    >
      <header class="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4">
        <a
          routerLink="/"
          class="border border-dotted border-[#efe8da]/55 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#efe8da] transition hover:border-[#efe8da] hover:bg-[#efe8da]/10 focus:outline-none focus:ring-4 focus:ring-[#efe8da]/35"
          aria-label="Back to home"
        >
          ← Back
        </a>
        <h1 class="font-soviet m-0 text-xl font-extrabold tracking-wide sm:text-2xl">
          Prompt Run
        </h1>
      </header>

      @if (loading()) {
        <p class="mx-auto mt-4 w-full max-w-6xl text-sm text-[#efe8da]/60" role="status">
          Loading prompt…
        </p>
      }

      @if (error(); as err) {
        <p class="mx-auto mt-4 w-full max-w-6xl text-sm text-[#a43f3f]" role="alert">
          {{ err }}
        </p>
      }

      @if (promptText(); as text) {
        <p
          class="mx-auto mt-4 w-full max-w-6xl border border-dotted border-[#efe8da]/40 px-5 py-4 text-sm leading-relaxed text-[#efe8da]/80"
        >
          {{ text }}
        </p>
      }

      <section
        class="mx-auto mt-4 grid min-h-[68dvh] w-full max-w-6xl flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"
        aria-label="Prompt run workspace"
      >
        <div class="h-[68dvh] min-h-[520px] overflow-hidden border border-dotted border-[#efe8da]/55" aria-label="Live prompt diagram">
          <ng-diagram
            class="block h-full w-full"
            [model]="diagramModel"
            [nodeTemplateMap]="nodeTemplateMap"
          />
        </div>

        <aside class="flex min-h-[340px] flex-col border border-dotted border-[#efe8da]/55" aria-label="Prompt run logs">
          <div class="border-b border-dotted border-[#efe8da]/35 px-4 py-3">
            <p class="m-0 text-xs font-bold uppercase tracking-[0.08em] text-[#efe8da]/55">Status</p>
            <p class="m-0 mt-1 text-lg font-bold text-[#efe8da]">{{ runStatus() }}</p>
            @if (agentProblem(); as problem) {
              <p class="m-0 mt-3 text-xs font-bold uppercase tracking-[0.08em] text-[#efe8da]/45">Agent input</p>
              <p class="m-0 mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-sm leading-5 text-[#efe8da]/75">{{ problem }}</p>
            }
          </div>

          <div class="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-4" aria-live="polite">
            @if (logs().length) {
              @for (log of logs(); track log.id) {
                <article class="border-l-2 border-[#efe8da]/35 pl-3">
                  <p class="m-0 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#efe8da]/45">
                    {{ log.type }} · {{ log.timestamp }}
                  </p>
                  <p class="m-0 mt-1 text-sm leading-6 text-[#efe8da]/82">{{ log.message }}</p>
                </article>
              }
            } @else {
              <p class="m-0 text-sm leading-6 text-[#efe8da]/55">Waiting for ai-agent events...</p>
            }

            @if (streamError(); as err) {
              <p class="m-0 border border-[#a43f3f] bg-[#a43f3f]/10 px-3 py-2 text-sm text-[#ffd1d1]" role="alert">
                {{ err }}
              </p>
            }
          </div>
        </aside>
      </section>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background: #0f1110;
    }

    ng-diagram {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class PromptDiagramPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly promptApi = inject(PromptApiService);
  private activeRunId: string | null = null;

  readonly nodeTemplateMap = new NgDiagramNodeTemplateMap([
    ['prompt', PromptNodeComponent],
  ]);

  readonly runEvents = signal<PromptRunEvent[]>([]);
  readonly streamError = signal<string | null>(null);

  private readonly state = toSignal(
    this.route.paramMap.pipe(
      map((params) => params.get('id')),
      switchMap((id) => {
        if (!id) {
          return of<PromptPageState>({
            loading: false,
            error: 'Missing prompt id in URL.',
            prompt: null,
          });
        }

        return this.promptApi.getPrompt(id).pipe(
          map((prompt) => ({ loading: false, error: null, prompt })),
          startWith({ loading: true, error: null, prompt: null }),
          catchError(() =>
            of<PromptPageState>({
              loading: false,
              error: 'Could not load the prompt. Please try again.',
              prompt: null,
            }),
          ),
        );
      }),
    ),
    {
      initialValue: {
        loading: true,
        error: null,
        prompt: null,
      } as PromptPageState,
    },
  );

  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly promptText = computed(() => this.state().prompt?.text ?? null);
  readonly promptId = computed(() => this.state().prompt?.id ?? null);
  readonly runStatus = computed(() => {
    const latestEvent = this.runEvents().at(-1);
    if (this.streamError()) return 'Stream disconnected';
    if (!latestEvent) return 'Waiting for run';
    if (latestEvent.type === 'run_completed') return 'Completed';
    if (latestEvent.type === 'error') return 'Failed';
    return 'Running';
  });
  readonly logs = computed(() =>
    this.runEvents().map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
      message: event.message,
    })),
  );
  readonly agentProblem = computed(
    () =>
      this.runEvents().find((event) => event.type === 'run_started')?.payload
        .problem ?? null,
  );
  readonly diagramModel: ModelAdapter = initializeModel(
    {
      nodes: this.diagramNodes(),
      edges: this.diagramEdges(),
    },
    this.injector,
  );

  constructor() {
    effect(() => {
      this.diagramModel.updateNodes(this.diagramNodes());
      this.diagramModel.updateEdges(this.diagramEdges());
    });

    effect(() => {
      const promptId = this.promptId();
      if (!promptId || promptId === this.activeRunId) return;

      this.activeRunId = promptId;
      this.runEvents.set([]);
      this.streamError.set(null);

      this.promptApi
        .streamPromptRun(promptId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (event) => this.runEvents.update((events) => [...events, event]),
          error: () =>
            this.streamError.set('Prompt run stream disconnected unexpectedly.'),
        });
    });
  }

  private diagramNodes(): DiagramNode[] {
    const events = this.runEvents();
    const promptLabel = this.promptText()?.slice(0, 120) ?? 'Loading prompt...';
    const agentProblem = events.find((event) => event.type === 'run_started')?.payload
      .problem;
    const nodes: DiagramNode[] = [
      {
        id: 'prompt-node',
        type: 'prompt',
        position: { x: 300, y: 40 },
        data: {
          label: promptLabel,
          subtitle: agentProblem
            ? `Agent received: ${agentProblem.slice(0, 90)}`
            : 'Saved prompt will be sent to ai-agent',
        },
        draggable: true,
      },
    ];

    if (events.some((event) => event.type === 'ranking')) {
      nodes.push({
        id: 'ranking-node',
        type: 'prompt',
        position: { x: 300, y: 240 },
        data: {
          label: 'Mechanism ranking ready',
          subtitle: 'TF-IDF similarity matched biomimicry mechanisms',
        },
        draggable: true,
      });
    }

    const mechanismEvents = events.filter(
      (event) => event.type === 'mechanism_selected' && event.payload.mechanism,
    );
    mechanismEvents.forEach((event, index) => {
      nodes.push({
        id: `mechanism-${event.payload.mechanism?.id ?? index}`,
        type: 'prompt',
        position: { x: 40 + index * 300, y: 440 },
        data: {
          label: event.payload.mechanism?.organism ?? 'Selected mechanism',
          subtitle: event.payload.mechanism?.mechanism ?? event.message,
        },
        draggable: true,
      });
    });

    const candidateEvents = events.filter(
      (event) => event.type === 'candidate' && event.payload.candidate,
    );
    candidateEvents.forEach((event, index) => {
      nodes.push({
        id: `candidate-${event.payload.candidate?.id ?? index}`,
        type: 'prompt',
        position: { x: 40 + index * 300, y: 650 },
        data: {
          label: event.payload.candidate?.tytul ?? 'Generated candidate',
          subtitle: event.payload.candidate?.opis ?? event.message,
        },
        draggable: true,
      });
    });

    const finalEvent = events.find(
      (event) => event.type === 'run_completed' || event.type === 'error',
    );
    if (finalEvent) {
      nodes.push({
        id: 'final-node',
        type: 'prompt',
        position: { x: 300, y: 880 },
        data: {
          label: finalEvent.type === 'error' ? 'Run failed' : 'Run completed',
          subtitle: finalEvent.message,
        },
        draggable: true,
      });
    }

    return nodes;
  }

  private diagramEdges(): Edge[] {
    const events = this.runEvents();
    const edges: Edge[] = [];

    if (events.some((event) => event.type === 'ranking')) {
      edges.push({
        id: 'edge-prompt-ranking',
        source: 'prompt-node',
        sourcePort: 'port-bottom',
        target: 'ranking-node',
        targetPort: 'port-top',
        routing: 'bezier',
        data: {},
      });
    }

    const mechanismEvents = events.filter(
      (event) => event.type === 'mechanism_selected' && event.payload.mechanism,
    );
    mechanismEvents.forEach((event, index) => {
      const mechanismId = `mechanism-${event.payload.mechanism?.id ?? index}`;
      edges.push({
        id: `edge-ranking-${mechanismId}`,
        source: 'ranking-node',
        sourcePort: 'port-bottom',
        target: mechanismId,
        targetPort: 'port-top',
        routing: 'bezier',
        data: {},
      });
    });

    const candidateEvents = events.filter(
      (event) => event.type === 'candidate' && event.payload.candidate,
    );
    candidateEvents.forEach((event, index) => {
      const candidateId = `candidate-${event.payload.candidate?.id ?? index}`;
      edges.push({
        id: `edge-mechanism-${candidateId}`,
        source: `mechanism-${event.payload.candidate?.id ?? index}`,
        sourcePort: 'port-bottom',
        target: candidateId,
        targetPort: 'port-top',
        routing: 'bezier',
        data: {},
      });
    });

    if (events.some((event) => event.type === 'run_completed' || event.type === 'error')) {
      edges.push({
        id: 'edge-final',
        source: candidateEvents.at(-1)?.payload.candidate
          ? `candidate-${candidateEvents.at(-1)?.payload.candidate?.id}`
          : 'ranking-node',
        sourcePort: 'port-bottom',
        target: 'final-node',
        targetPort: 'port-top',
        routing: 'bezier',
        data: {},
      });
    }

    return edges;
  }
}

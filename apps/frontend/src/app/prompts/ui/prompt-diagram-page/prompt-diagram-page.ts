import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  NgDiagramComponent,
  NgDiagramNodeTemplateMap,
  NgDiagramViewportService,
  initializeModel,
  provideNgDiagram,
} from 'ng-diagram';
import type { Edge, Node } from 'ng-diagram';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { PromptApiService } from '../../data/prompt-api.service';
import { Prompt, PromptRunEvent } from '../../data/types';
import {
  RunCardNodeComponent,
  RunCardNodeData,
  RunCardVariant,
} from '../run-card-node/run-card-node';

type PromptPageState = {
  loading: boolean;
  error: string | null;
  prompt: Prompt | null;
};

type DiagramCard = {
  id: string;
  stage: string;
  title: string;
  subtitle: string;
  detail?: string;
  meta?: string;
  badge?: string;
};

type LogTone = 'muted' | 'info' | 'warn' | 'success' | 'error';

type RunLogEntry = {
  id: string;
  time: string;
  type: string;
  tone: LogTone;
  message: string;
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
        <div
          #diagramHost
          class="diagram-panel"
          role="region"
          aria-label="Live prompt diagram"
        >
          <ng-diagram
            [model]="model"
            [nodeTemplateMap]="nodeTemplateMap"
            (diagramInit)="onDiagramInit()"
          />
        </div>

        <aside class="log-panel" aria-label="Prompt run logs">
          <div class="log-panel__header">
            <div class="log-panel__title-row">
              <p class="log-panel__label">Run log</p>
              <span class="log-panel__count">{{ logs().length }} events</span>
            </div>
            <p class="log-status" [class]="'log-status log-status--' + statusTone()">
              <span class="log-status__dot" aria-hidden="true"></span>
              {{ runStatus() }}
            </p>
            @if (agentProblem(); as problem) {
              <details class="log-agent">
                <summary>Agent input</summary>
                <p>{{ problem }}</p>
              </details>
            }
          </div>

          <div
            #logScroll
            class="log-panel__scroll"
            aria-live="polite"
            (scroll)="onLogScroll($event)"
          >
            @if (logs().length) {
              <ol class="log-list">
                @for (log of logs(); track log.id) {
                  <li [class]="'log-entry log-entry--' + log.tone">
                    <p class="log-entry__meta">
                      <span class="log-entry__type">{{ log.type }}</span>
                      @if (log.time) {
                        <time class="log-entry__time">{{ log.time }}</time>
                      }
                    </p>
                    <p class="log-entry__message">{{ log.message }}</p>
                  </li>
                }
              </ol>
            } @else {
              <div class="log-empty" role="status">
                <span class="log-empty__dots" aria-hidden="true"><i></i><i></i><i></i></span>
                <p>Waiting for ai-agent events…</p>
              </div>
            }

            @if (streamError(); as err) {
              <p class="log-stream-error" role="alert">{{ err }}</p>
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

    .diagram-panel {
      display: flex;
      min-height: 68dvh;
      max-height: 76dvh;
      overflow: hidden;
      border: 1px dotted rgb(239 232 218 / 55%);
      background:
        linear-gradient(rgb(239 232 218 / 5%) 1px, transparent 1px),
        linear-gradient(90deg, rgb(239 232 218 / 5%) 1px, transparent 1px);
      background-size: 28px 28px;
    }

    .diagram-panel ng-diagram {
      flex: 1;
      min-width: 0;
      --ngd-diagram-background-color: transparent;
      --ngd-background-dot-color: rgb(239 232 218 / 30%);
    }

    .log-panel {
      display: flex;
      flex-direction: column;
      min-height: 340px;
      max-height: 76dvh;
      border: 1px dotted rgb(239 232 218 / 55%);
      background: rgb(239 232 218 / 3%);
    }

    .log-panel__header {
      border-bottom: 1px dotted rgb(239 232 218 / 35%);
      padding: 12px 16px;
    }

    .log-panel__title-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
    }

    .log-panel__label {
      margin: 0;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgb(239 232 218 / 55%);
    }

    .log-panel__count {
      font-size: 0.7rem;
      font-variant-numeric: tabular-nums;
      color: rgb(239 232 218 / 45%);
    }

    .log-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 8px 0 0;
      border: 1px dotted rgb(239 232 218 / 40%);
      padding: 4px 10px;
      font-size: 0.82rem;
      font-weight: 700;
      color: #efe8da;
    }

    .log-status__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgb(239 232 218 / 45%);
      flex-shrink: 0;
    }

    .log-status--running .log-status__dot {
      background: #e8c258;
      animation: statusPulse 1.2s ease-in-out infinite;
    }

    .log-status--done {
      border-color: rgb(143 191 127 / 55%);
    }

    .log-status--done .log-status__dot {
      background: #8fbf7f;
    }

    .log-status--failed {
      border-color: rgb(212 106 106 / 65%);
      color: #ffd1d1;
    }

    .log-status--failed .log-status__dot {
      background: #d46a6a;
    }

    .log-agent {
      margin-top: 10px;
    }

    .log-agent summary {
      cursor: pointer;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgb(239 232 218 / 45%);
      user-select: none;
    }

    .log-agent summary:hover {
      color: rgb(239 232 218 / 75%);
    }

    .log-agent p {
      margin: 6px 0 0;
      max-height: 6rem;
      overflow: auto;
      white-space: pre-wrap;
      font-size: 0.84rem;
      line-height: 1.45;
      color: rgb(239 232 218 / 75%);
    }

    .log-panel__scroll {
      min-height: 0;
      flex: 1;
      overflow: auto;
      padding: 14px 16px;
      scrollbar-width: thin;
      scrollbar-color: rgb(239 232 218 / 30%) transparent;
    }

    .log-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
    }

    .log-entry {
      --tone: rgb(239 232 218 / 35%);
      position: relative;
      border-left: 2px solid var(--tone);
      background: rgb(239 232 218 / 4%);
      padding: 8px 10px 9px 12px;
      animation: logEnter 0.25s ease-out both;
    }

    .log-entry--info {
      --tone: rgb(126 166 204 / 75%);
    }

    .log-entry--warn {
      --tone: rgb(232 194 88 / 80%);
    }

    .log-entry--success {
      --tone: rgb(143 191 127 / 80%);
    }

    .log-entry--error {
      --tone: rgb(212 106 106 / 85%);
      background: rgb(212 106 106 / 8%);
    }

    .log-entry__meta {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      margin: 0;
    }

    .log-entry__type {
      font-size: 0.64rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--tone);
    }

    .log-entry__time {
      font-size: 0.66rem;
      font-variant-numeric: tabular-nums;
      color: rgb(239 232 218 / 40%);
      white-space: nowrap;
    }

    .log-entry__message {
      margin: 4px 0 0;
      font-size: 0.84rem;
      line-height: 1.5;
      overflow-wrap: anywhere;
      color: rgb(239 232 218 / 82%);
    }

    .log-empty {
      display: grid;
      justify-items: center;
      gap: 10px;
      padding: 36px 0;
      color: rgb(239 232 218 / 55%);
    }

    .log-empty p {
      margin: 0;
      font-size: 0.86rem;
    }

    .log-empty__dots {
      display: inline-flex;
      gap: 6px;
    }

    .log-empty__dots i {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: rgb(239 232 218 / 45%);
      animation: statusPulse 1.2s ease-in-out infinite;
    }

    .log-empty__dots i:nth-child(2) {
      animation-delay: 0.2s;
    }

    .log-empty__dots i:nth-child(3) {
      animation-delay: 0.4s;
    }

    .log-stream-error {
      margin: 12px 0 0;
      border: 1px solid #a43f3f;
      background: rgb(164 63 63 / 10%);
      padding: 8px 12px;
      font-size: 0.84rem;
      color: #ffd1d1;
    }

    @keyframes statusPulse {
      0%,
      100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.35;
        transform: scale(0.75);
      }
    }

    @keyframes logEnter {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
})
export class PromptDiagramPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly promptApi = inject(PromptApiService);
  private readonly viewportService = inject(NgDiagramViewportService);
  private activeRunId: string | null = null;

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
  readonly statusTone = computed<'waiting' | 'running' | 'done' | 'failed'>(() => {
    const status = this.runStatus();
    if (status === 'Completed') return 'done';
    if (status === 'Failed' || status === 'Stream disconnected') return 'failed';
    if (status === 'Running') return 'running';
    return 'waiting';
  });
  readonly logs = computed<RunLogEntry[]>(() =>
    [
      ...(this.promptText()
        ? [
            {
              id: 'loaded-prompt',
              time: '',
              type: 'prompt',
              tone: 'muted' as LogTone,
              message: `Loaded saved prompt: ${this.promptText()}`,
            },
          ]
        : []),
      ...this.runEvents().flatMap((event) => this.eventLogEntries(event)),
    ],
  );
  readonly agentProblem = computed(
    () =>
      this.runEvents().find((event) => event.type === 'run_started')?.payload
        .problem ?? null,
  );
  readonly functionQuery = computed(
    () =>
      this.runEvents().find((event) => event.type === 'run_started')?.payload
        .functionQuery ?? null,
  );
  readonly databaseEvent = computed(() =>
    this.runEvents().find((event) => event.type === 'database_loaded'),
  );
  readonly vectorizedEvent = computed(() =>
    this.runEvents().find((event) => event.type === 'vectorized'),
  );
  readonly rankingEvent = computed(() =>
    this.runEvents().find((event) => event.type === 'ranking'),
  );
  readonly topRanking = computed(
    () => this.rankingEvent()?.payload.ranking?.slice(0, 3) ?? [],
  );
  readonly mechanismEvents = computed(() =>
    this.runEvents().filter(
      (event) => event.type === 'mechanism_selected' && event.payload.mechanism,
    ),
  );
  readonly candidateEvents = computed(() =>
    this.runEvents().filter(
      (event) => event.type === 'candidate' && event.payload.candidate,
    ),
  );
  readonly completedEvent = computed(() =>
    this.runEvents().find((event) => event.type === 'run_completed'),
  );
  readonly evaluation = computed(
    () =>
      this.runEvents().find((event) => event.type === 'scored')?.payload
        .evaluation ??
      this.completedEvent()?.payload.reasoningTrail?.evaluation ??
      null,
  );
  readonly errorEvent = computed(() =>
    this.runEvents().find((event) => event.type === 'error'),
  );

  readonly spineCards = computed<DiagramCard[]>(() => {
    const cards: DiagramCard[] = [
      {
        id: 'user-problem',
        stage: '01 user problem',
        title: 'User problem',
        subtitle: this.agentProblem()
          ? 'Sent to ai-agent'
          : 'Waiting to start biomimicry analysis',
        detail: this.promptText() ?? 'Loading saved prompt...',
      },
    ];

    if (this.functionQuery()) {
      cards.push({
        id: 'function-query',
        stage: '02 function query',
        title: 'Function query',
        subtitle: 'Notebook default used for similarity ranking',
        detail: this.functionQuery() ?? '',
      });
    }

    const databaseEvent = this.databaseEvent();
    if (databaseEvent) {
      cards.push({
        id: 'biomimicry-db',
        stage: '03 biomimicry db',
        title: 'Biomimicry DB',
        subtitle: `${databaseEvent.payload.databaseCount ?? 0} mechanisms loaded`,
        detail: 'Biological mechanisms are ready for functional matching.',
      });
    }

    const vectorizedEvent = this.vectorizedEvent();
    if (vectorizedEvent) {
      cards.push({
        id: 'tfidf',
        stage: '04 tf-idf similarity',
        title: 'TF-IDF similarity',
        subtitle: 'Vectorized functions + query',
        detail: 'Calculated cosine similarity scores for every mechanism.',
        meta: `${vectorizedEvent.payload.corpusSize ?? 0} corpus items · ${
          vectorizedEvent.payload.featureCount ?? 0
        } features`,
      });
    }

    if (this.rankingEvent()) {
      cards.push({
        id: 'ranking',
        stage: '05 ranking',
        title: 'Ranking',
        subtitle: 'Top biomimicry matches',
        detail: this.topRanking()
          .map(
            (row) =>
              `[${row.id}] ${row.organism} - ${row.mechanism} (${row.similarity.toFixed(3)})`,
          )
          .join('\n'),
      });
    }

    return cards;
  });

  readonly mechanismCards = computed<DiagramCard[]>(() =>
    this.mechanismEvents().map((event, index) => ({
      id: `mechanism-${event.payload.mechanism?.id ?? index}`,
      stage: `06 selected ${index + 1}`,
      title: `[${event.payload.mechanism?.id}] ${event.payload.mechanism?.organism}`,
      subtitle: event.payload.mechanism?.mechanism ?? event.message,
      detail: event.payload.mechanism?.principle ?? '',
    })),
  );

  readonly candidateCards = computed<DiagramCard[]>(() =>
    this.candidateEvents().map((event, index) => ({
      id: `candidate-${event.payload.candidate?.id ?? index}`,
      stage: `07 candidate ${index + 1}`,
      title: event.payload.candidate?.tytul ?? 'Generated candidate',
      subtitle: event.payload.candidate?.zrodlo_mechanizmu ?? event.message,
      detail: event.payload.candidate?.opis ?? '',
      badge: event.payload.candidate?.fallback ? 'local fallback' : undefined,
    })),
  );

  readonly finalCard = computed<DiagramCard | null>(() => {
    const errorEvent = this.errorEvent();
    if (errorEvent) {
      return {
        id: 'run-failed',
        stage: 'error',
        title: 'Run failed',
        subtitle: errorEvent.message,
        detail: errorEvent.payload.detail ?? 'The stream stopped before completion.',
      };
    }

    const evaluation = this.evaluation();
    if (!evaluation) return null;

    const best = evaluation.candidateScores.find(
      (score) => score.id === evaluation.bestCandidateId,
    );

    return {
      id: 'solution-score',
      stage: '08 solution score',
      title: `Solution score: ${evaluation.overallScore}/100`,
      subtitle: evaluation.verdict,
      detail: evaluation.candidateScores
        .map((score) => `[${score.id}] ${score.tytul} — ${score.score}/100`)
        .join('\n'),
      meta: best ? `Best: ${best.tytul} (${best.score}/100)` : undefined,
      badge: `${evaluation.overallScore}/100`,
    };
  });

  readonly nodeTemplateMap = new NgDiagramNodeTemplateMap([
    ['run-card', RunCardNodeComponent],
  ]);

  readonly model = initializeModel({ nodes: [], edges: [] });

  private readonly graph = computed(() => {
    const COLUMN_GAP = 400;
    const ROW_GAP = 250;

    const nodes: Node<RunCardNodeData>[] = [];
    const edges: Edge[] = [];

    const addEdge = (source: string, target: string) =>
      edges.push({
        id: `e-${source}-${target}`,
        source,
        sourcePort: 'port-bottom',
        target,
        targetPort: 'port-top',
        routing: 'bezier',
        data: {},
      });

    const spine = this.spineCards();
    spine.forEach((card, index) => {
      nodes.push(this.toNode(card, 'spine', 0, index * ROW_GAP));
      if (index > 0) addEdge(spine[index - 1].id, card.id);
    });

    let y = spine.length * ROW_GAP + 40;
    const lastSpineId = spine.at(-1)?.id ?? null;

    const mechanisms = this.mechanismCards();
    mechanisms.forEach((card, index) => {
      const x = (index - (mechanisms.length - 1) / 2) * COLUMN_GAP;
      nodes.push(this.toNode(card, 'mechanism', x, y));
      if (lastSpineId) addEdge(lastSpineId, card.id);
    });
    if (mechanisms.length) y += ROW_GAP + 40;

    const candidates = this.candidateCards();
    candidates.forEach((card, index) => {
      const x = (index - (candidates.length - 1) / 2) * COLUMN_GAP;
      nodes.push(this.toNode(card, 'candidate', x, y));
      const parent = mechanisms.length
        ? mechanisms[index % mechanisms.length].id
        : lastSpineId;
      if (parent) addEdge(parent, card.id);
    });
    if (candidates.length) y += ROW_GAP + 40;

    const finalCard = this.finalCard();
    if (finalCard) {
      nodes.push(this.toNode(finalCard, 'terminal', 0, y));
      const parents = candidates.length
        ? candidates
        : mechanisms.length
          ? mechanisms
          : lastSpineId
            ? [{ id: lastSpineId }]
            : [];
      parents.forEach((parent) => addEdge(parent.id, finalCard.id));
    }

    return { nodes, edges };
  });

  private toNode(
    card: DiagramCard,
    variant: RunCardVariant,
    x: number,
    y: number,
  ): Node<RunCardNodeData> {
    return {
      id: card.id,
      type: 'run-card',
      position: { x, y },
      draggable: true,
      data: {
        stage: card.stage,
        title: card.title,
        subtitle: card.subtitle,
        detail: card.detail,
        meta: card.meta,
        badge: card.badge,
        variant,
      },
    };
  }

  private readonly logScroll =
    viewChild<ElementRef<HTMLElement>>('logScroll');
  private stickToBottom = true;
  private diagramReady = false;
  private viewportFitScheduled = false;
  private pendingFit = false;
  private readonly CARD_WIDTH = 340;
  private readonly CARD_HEIGHT = 170;
  private readonly FOLLOW_SCALE = 0.8;
  private readonly diagramHost =
    viewChild<ElementRef<HTMLElement>>('diagramHost');

  onDiagramInit(): void {
    this.diagramReady = true;
    if (this.pendingFit) {
      this.pendingFit = false;
      this.scheduleViewportFit();
    }
  }

  private scheduleViewportFit(): void {
    if (!this.diagramReady) {
      this.pendingFit = true;
      return;
    }
    if (this.viewportFitScheduled) return;
    this.viewportFitScheduled = true;
    setTimeout(() => {
      this.viewportFitScheduled = false;
      this.centerOnLatestNode();
    }, 140);
  }

  private centerOnLatestNode(): void {
    const nodes = this.graph().nodes;
    const latest = nodes.at(-1);
    const host = this.diagramHost()?.nativeElement;
    if (!latest || !host) return;

    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;

    const scale = this.FOLLOW_SCALE;
    const centerX = latest.position.x + this.CARD_WIDTH / 2;
    const centerY = latest.position.y + this.CARD_HEIGHT / 2;
    const x = width / 2 - centerX * scale;
    const y = height / 2 - centerY * scale;

    try {
      this.viewportService.setViewport(x, y, scale);
    } catch {
      // viewport not ready yet
    }
  }

  onLogScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.stickToBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }

  constructor() {
    effect(() => {
      const { nodes, edges } = this.graph();
      this.model.updateNodes(nodes);
      this.model.updateEdges(edges);
      if (nodes.length) this.scheduleViewportFit();
    });

    afterRenderEffect(() => {
      this.logs();
      this.streamError();
      const el = this.logScroll()?.nativeElement;
      if (el && this.stickToBottom) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
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

  private eventLogEntries(event: PromptRunEvent): RunLogEntry[] {
    const time = this.formatTime(event.timestamp);
    const tone = this.eventTone(event.type);

    if (event.type === 'run_started') {
      return [
        {
          id: `${event.id}-problem`,
          time,
          type: event.type,
          tone,
          message: `Problem received by ai-agent: ${event.payload.problem ?? ''}`,
        },
        {
          id: `${event.id}-query`,
          time,
          type: event.type,
          tone,
          message: `Function query: ${event.payload.functionQuery ?? ''}`,
        },
      ];
    }

    if (event.type === 'ranking') {
      return [
        {
          id: event.id,
          time,
          type: event.type,
          tone,
          message:
            'Top ranking: ' +
            (event.payload.ranking ?? [])
              .slice(0, 3)
              .map(
                (row) =>
                  `[${row.id}] ${row.organism} - ${row.mechanism} (${row.similarity.toFixed(3)})`,
              )
              .join('; '),
        },
      ];
    }

    if (event.type === 'candidate') {
      return [
        {
          id: event.id,
          time,
          type: event.type,
          tone,
          message: `[${event.payload.candidate?.id}] ${event.payload.candidate?.tytul} - ${event.payload.candidate?.opis}`,
        },
      ];
    }

    if (event.type === 'scored') {
      const evaluation = event.payload.evaluation;
      return [
        {
          id: event.id,
          time,
          type: event.type,
          tone,
          message:
            `Solution score ${evaluation?.overallScore ?? 0}/100 — ${evaluation?.verdict ?? ''} ` +
            (evaluation?.candidateScores ?? [])
              .map((score) => `[${score.id}] ${score.score}/100`)
              .join('; '),
        },
      ];
    }

    return [
      {
        id: event.id,
        time,
        type: event.type,
        tone,
        message: event.message,
      },
    ];
  }

  private eventTone(type: string): LogTone {
    switch (type) {
      case 'error':
        return 'error';
      case 'run_completed':
      case 'candidate':
      case 'scored':
        return 'success';
      case 'mechanism_selected':
      case 'ranking':
        return 'warn';
      case 'run_started':
      case 'database_loaded':
      case 'vectorized':
        return 'info';
      default:
        return 'muted';
    }
  }

  private formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour12: false });
  }
}

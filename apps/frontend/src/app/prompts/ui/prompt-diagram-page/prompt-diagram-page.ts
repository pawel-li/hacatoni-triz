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
import { Prompt, PromptRunCostSummary, PromptRunEvent } from '../../data/types';
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
  sourceId?: string;
  best?: boolean;
  method?: 'triz' | 'biomimicry';
  table?: { header: string[]; rows: string[][] };
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
      aria-label="Strona promptu"
    >
      <header class="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4">
        <a
          routerLink="/"
          class="border border-dotted border-[#efe8da]/55 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#efe8da] transition hover:border-[#efe8da] hover:bg-[#efe8da]/10 focus:outline-none focus:ring-4 focus:ring-[#efe8da]/35"
          aria-label="Powrot do strony glownej"
        >
          ← Wroc
        </a>
        <h1 class="font-soviet m-0 text-xl font-extrabold tracking-wide sm:text-2xl">
          Przebieg promptu
        </h1>
      </header>

      @if (loading()) {
        <p class="mx-auto mt-4 w-full max-w-6xl text-sm text-[#efe8da]/60" role="status">
          Ladowanie promptu...
        </p>
      }

      @if (error(); as err) {
        <p class="mx-auto mt-4 w-full max-w-6xl text-sm text-[#a43f3f]" role="alert">
          {{ err }}
        </p>
      }

      <section
        class="mx-auto mt-4 grid min-h-[68dvh] w-full max-w-6xl flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"
        aria-label="Przestrzen przebiegu promptu"
      >
        <div
          #diagramHost
          class="diagram-panel"
          role="region"
          aria-label="Diagram przebiegu"
        >
          @if (shouldShowDiagram()) {
            <ng-diagram
              [model]="model"
              [nodeTemplateMap]="nodeTemplateMap"
              (diagramInit)="onDiagramInit()"
            />
          } @else {
            <div class="diagram-loading" role="status" aria-live="polite">
              <span class="diagram-loading__pulse" aria-hidden="true"></span>
              <p class="diagram-loading__title">Przygotowywanie diagramu przebiegu</p>
              <p class="diagram-loading__message">{{ diagramLoadingMessage() }}</p>
              <p class="diagram-loading__meta">{{ logs().length }} zdarzen</p>
            </div>
          }
        </div>

        <aside class="log-panel" aria-label="Logi przebiegu promptu">
          <div class="log-panel__header">
            <div class="log-panel__title-row">
              <p class="log-panel__label">Dziennik przebiegu</p>
              <span class="log-panel__count">{{ logs().length }} zdarzen</span>
            </div>
            <p class="log-status" [class]="'log-status log-status--' + statusTone()">
              <span class="log-status__dot" aria-hidden="true"></span>
              {{ runStatus() }}
            </p>
            @if (displayedCost(); as cost) {
              <dl class="log-cost" aria-label="Koszt przebiegu">
                <div>
                  <dt>Koszt</dt>
                  <dd>{{ formatCost(cost.totalCostUsd) }}</dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>{{ cost.model }}</dd>
                </div>
                <div>
                  <dt>Tokeny</dt>
                  <dd>{{ cost.totalTokens }}</dd>
                </div>
              </dl>
            }
            @if (agentProblem(); as problem) {
              <details class="log-agent">
                <summary>Wejscie agenta</summary>
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
                      <span class="log-entry__type">{{ formatLogType(log.type) }}</span>
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
                <p>Oczekiwanie na zdarzenia ai-agent...</p>
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

    .diagram-loading {
      position: relative;
      width: 100%;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 8px;
      padding: 24px;
      text-align: center;
      background:
        radial-gradient(circle at 50% 35%, rgb(143 191 127 / 16%), transparent 58%),
        linear-gradient(140deg, rgb(15 17 16 / 40%), rgb(15 17 16 / 12%));
    }

    .diagram-loading::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        110deg,
        transparent 28%,
        rgb(239 232 218 / 8%) 44%,
        transparent 58%
      );
      animation: loadingSweep 2.2s linear infinite;
      pointer-events: none;
    }

    .diagram-loading__pulse {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      border: 2px dotted rgb(239 232 218 / 65%);
      position: relative;
      display: inline-block;
      animation: loadingSpin 1.2s linear infinite;
    }

    .diagram-loading__pulse::after {
      content: '';
      position: absolute;
      inset: 14px;
      border-radius: 50%;
      background: rgb(239 232 218 / 55%);
      animation: statusPulse 1s ease-in-out infinite;
    }

    .diagram-loading__title {
      margin: 2px 0 0;
      font-size: 0.84rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #efe8da;
    }

    .diagram-loading__message {
      margin: 0;
      max-width: 24rem;
      font-size: 0.9rem;
      line-height: 1.5;
      color: rgb(239 232 218 / 78%);
    }

    .diagram-loading__meta {
      margin: 0;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: rgb(239 232 218 / 50%);
    }

    .diagram-panel ng-diagram {
      flex: 1;
      min-width: 0;
      --ngd-diagram-background-color: transparent;
      --ngd-background-dot-color: rgb(239 232 218 / 30%);
      --ngd-default-edge-stroke: rgb(239 232 218 / 60%);
      --ngd-default-edge-stroke-hover: rgb(239 232 218 / 90%);
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

    .log-cost {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin: 10px 0 0;
    }

    .log-cost div {
      min-width: 0;
      border: 1px dotted rgb(239 232 218 / 30%);
      padding: 7px 8px;
      background: rgb(143 191 127 / 7%);
    }

    .log-cost dt {
      margin: 0 0 3px;
      font-size: 0.58rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgb(239 232 218 / 45%);
    }

    .log-cost dd {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: 0.76rem;
      font-weight: 800;
      color: #efe8da;
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

    @keyframes loadingSpin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes loadingSweep {
      from {
        transform: translateX(-130%);
      }
      to {
        transform: translateX(130%);
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
            error: 'Brakuje identyfikatora promptu w adresie URL.',
            prompt: null,
          });
        }

        return this.promptApi.getPrompt(id).pipe(
          map((prompt) => ({ loading: false, error: null, prompt })),
          startWith({ loading: true, error: null, prompt: null }),
          catchError(() =>
            of<PromptPageState>({
              loading: false,
              error: 'Nie udalo sie wczytac promptu. Sprobuj ponownie.',
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
  readonly prompt = computed(() => this.state().prompt);
  readonly promptText = computed(() => this.state().prompt?.text ?? null);
  readonly promptId = computed(() => this.state().prompt?.id ?? null);
  readonly streamFinished = computed(() => {
    if (this.streamError()) return true;
    const latestEvent = this.runEvents().at(-1);
    return latestEvent?.type === 'run_completed' || latestEvent?.type === 'error';
  });
  readonly shouldShowDiagram = computed(
    () => this.streamFinished() && this.graph().nodes.length > 0,
  );
  readonly diagramLoadingMessage = computed(() => {
    if (this.loading()) return 'Ladowanie szczegolow promptu...';
    if (this.error()) return 'Nie mozna wczytac promptu.';
    if (this.streamError()) {
      return this.graph().nodes.length
        ? 'Strumien zostal rozlaczony. W logu widoczne sa czesciowe wyniki.'
        : 'Strumien zostal rozlaczony zanim udalo sie wygenerowac diagram.';
    }
    if (this.streamFinished() && this.graph().nodes.length === 0) {
      return 'Przebieg zakonczyl sie, ale nie wygenerowano wezlow diagramu.';
    }
    if (!this.runEvents().length) {
      return 'Oczekiwanie na rozpoczecie przebiegu przez ai-agent...';
    }
    return 'Odczytywanie zdarzen na zywo i budowanie finalnego diagramu...';
  });
  readonly runStatus = computed(() => {
    const latestEvent = this.runEvents().at(-1);
    if (this.streamError()) return 'Strumien rozlaczony';
    if (!latestEvent) return 'Oczekiwanie na przebieg';
    if (latestEvent.type === 'run_completed') return 'Zakonczono';
    if (latestEvent.type === 'error') return 'Blad';
    return 'W trakcie';
  });
  readonly statusTone = computed<'waiting' | 'running' | 'done' | 'failed'>(() => {
    const latestEvent = this.runEvents().at(-1);
    if (this.streamError()) return 'failed';
    if (!latestEvent) return 'waiting';
    if (latestEvent.type === 'run_completed') return 'done';
    if (latestEvent.type === 'error') return 'failed';
    if (latestEvent.type) return 'running';
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
              message: `Wczytano zapisany prompt: ${this.promptText()}`,
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
  readonly functionQueryEvent = computed(() =>
    this.runEvents().find((event) => event.type === 'function_query'),
  );
  readonly functionQuery = computed(
    () =>
      this.functionQueryEvent()?.payload.functionQuery ??
      this.runEvents().find((event) => event.type === 'run_started')?.payload
        .functionQuery ??
      null,
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
  readonly candidateEvents = computed(() =>
    this.runEvents().filter(
      (event) => event.type === 'candidate' && event.payload.candidate,
    ),
  );
  readonly contradictionEvent = computed(() =>
    this.runEvents().find(
      (event) => event.type === 'contradiction_found' && event.payload.contradiction,
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
  readonly displayedCost = computed<PromptRunCostSummary | null>(() => {
    const streamedCost =
      [...this.runEvents()]
        .reverse()
        .find((event: PromptRunEvent) => event.payload.cost)?.payload.cost ?? null;
    if (streamedCost) return streamedCost;

    const savedRun = this.prompt()?.runs?.[0];
    if (!savedRun) return null;

    return {
      provider: savedRun.provider ?? 'unknown',
      model: savedRun.model ?? 'unknown',
      promptTokens: savedRun.promptTokens,
      completionTokens: savedRun.completionTokens,
      totalTokens: savedRun.totalTokens,
      inputCostUsd: 0,
      outputCostUsd: 0,
      totalCostUsd: savedRun.costUsd,
      currency: savedRun.currency,
      calls: 0,
      pricing: 'suma zapisanego przebiegu',
    };
  });

  readonly spineCards = computed<DiagramCard[]>(() => {
    const cards: DiagramCard[] = [
      {
        id: 'user-problem',
        stage: '01 problem uzytkownika',
        title: 'Problem uzytkownika',
        subtitle: this.agentProblem()
          ? 'Przekazano do ai-agent'
          : 'Oczekiwanie na start analizy biomimikry',
        detail: this.compactText(this.promptText() ?? 'Ladowanie zapisanego promptu...', 140),
      },
    ];

    if (this.functionQuery() || this.rankingEvent()) {
      const databaseEvent = this.databaseEvent();
      const vectorizedEvent = this.vectorizedEvent();
      cards.push({
        id: 'bio-matching',
        stage: '02 dopasowanie biomimikry',
        title: 'Dopasowanie biomimikry',
        subtitle: this.functionQuery() ?? 'Dopasowywanie mechanizmow biologicznych',
        detail: this.rankingEvent()
          ? `${this.topRanking().length} wybranych najmocniejszych dopasowan biologicznych`
          : 'Rankingowanie mechanizmow biologicznych przez TF-IDF...',
        meta:
          [
            databaseEvent
              ? `${databaseEvent.payload.databaseCount ?? 0} mechanizmow`
              : null,
            vectorizedEvent
              ? `${vectorizedEvent.payload.featureCount ?? 0} cech TF-IDF`
              : null,
          ]
            .filter(Boolean)
            .join(' · ') || undefined,
      });
    }

    return cards;
  });

  readonly contradictionCard = computed<DiagramCard | null>(() => {
    const event = this.contradictionEvent();
    if (!event) return null;
    const contradiction = event.payload.contradiction;
    return {
      id: 'triz-contradiction',
      stage: '03 sprzecznosc TRIZ',
      title: 'Sprzecznosc techniczna',
      subtitle: this.compactText(
        contradiction?.triz_contradiction_statement ?? event.message,
        130,
      ),
      detail: (contradiction?.triz_inventive_principles ?? []).join(' · '),
      meta: `${contradiction?.feature_to_improve ?? ''} kontra ${contradiction?.feature_that_worsens ?? ''}`,
      method: 'triz',
    };
  });

  readonly candidateCards = computed<DiagramCard[]>(() => {
    const evaluation = this.evaluation();
    return this.candidateEvents().map((event, index) => {
      const candidate = event.payload.candidate;
      const sourceId = candidate?.id ?? `${index}`;
      const score =
        evaluation?.candidateScores.find((item) => item.id === sourceId) ?? null;
      const best = !!score && evaluation?.bestCandidateId === sourceId;
      const method =
        candidate?.method ?? (sourceId.startsWith('T') ? 'triz' : 'biomimicry');
      return {
        id: `candidate-${sourceId}`,
        sourceId,
        method,
        stage:
          method === 'triz'
            ? `04 kandydat TRIZ`
            : `04 kandydat ${index + 1}`,
        title: candidate?.tytul ?? 'Wygenerowany kandydat',
        subtitle: '',
        detail: candidate?.opis || undefined,
        badge: score
          ? `${best ? '★ ' : ''}${score.score}/100`
          : candidate?.fallback
            ? 'lokalne zastepstwo'
            : undefined,
        best,
      };
    });
  });

  readonly finalCard = computed<DiagramCard | null>(() => {
    const errorEvent = this.errorEvent();
    if (errorEvent) {
      return {
        id: 'run-failed',
        stage: 'error',
        title: 'Przebieg zakonczony bledem',
        subtitle: errorEvent.message,
        detail: errorEvent.payload.detail ?? 'Strumien zatrzymal sie przed zakonczeniem.',
      };
    }

    const evaluation = this.evaluation();
    const cost = this.displayedCost();
    if (!evaluation) return null;

    const best = evaluation.candidateScores.find(
      (score) => score.id === evaluation.bestCandidateId,
    );

    return {
      id: 'solution-score',
      stage: '05 ocena rozwiazania',
      title: `Ocena rozwiazania: ${evaluation.overallScore}/100`,
      subtitle: this.compactText(evaluation.verdict, 150),
      table: {
        header: ['ID', 'Rozwiazanie', 'Ocena'],
        rows: evaluation.candidateScores.map((score) => [
          score.id,
          `${score.id === evaluation.bestCandidateId ? '★ ' : ''}${score.tytul}`,
          `${score.score}/100`,
        ]),
      },
      meta: [best ? `Najlepsze: ${best.tytul}` : null, cost ? this.formatCost(cost.totalCostUsd) : null]
        .filter(Boolean)
        .join(' · ') || undefined,
      badge: cost ? this.formatCost(cost.totalCostUsd) : `${evaluation.overallScore}/100`,
    };
  });

  readonly nodeTemplateMap = new NgDiagramNodeTemplateMap([
    ['run-card', RunCardNodeComponent],
  ]);

  readonly model = initializeModel({ nodes: [], edges: [] });

  private readonly WIDE_CARD_WIDTH = 360;
  private readonly COMPACT_CARD_WIDTH = 320;
  private readonly BRANCH_COLUMN_GAP = this.WIDE_CARD_WIDTH + 180;
  private readonly CANDIDATE_COLUMN_GAP = this.COMPACT_CARD_WIDTH + 140;
  private readonly VERTICAL_GAP = 150;

  private estimateCardHeight(card: DiagramCard, variant: RunCardVariant): number {
    const width = variant === 'candidate' || variant === 'best'
      ? this.COMPACT_CARD_WIDTH
      : this.WIDE_CARD_WIDTH;
    const charsPerLine = Math.max(24, Math.floor((width - 44) / 7));
    const textLines = (text: string | undefined, cpl: number) => {
      if (!text) return 0;
      const normalized = text.replace(/\s+/g, ' ').trim();
      return normalized ? Math.ceil(normalized.length / cpl) : 0;
    };

    let height = 38; // vertical padding
    height += 30; // stage/badge header row
    height += 14 + textLines(card.title, Math.floor(charsPerLine * 0.72)) * 24;
    height += card.subtitle ? 10 + textLines(card.subtitle, charsPerLine) * 21 : 0;
    height += card.detail ? 10 + textLines(card.detail, charsPerLine - 3) * 21 : 0;
    height += card.meta ? 20 + textLines(card.meta, charsPerLine) * 21 : 0;
    if (card.table) {
      height += 12 + 26 + card.table.rows.length * 28;
    }
    return Math.max(140, height);
  }

  private readonly graph = computed(() => {
    const nodes: Node<RunCardNodeData>[] = [];
    const edges: Edge[] = [];
    const heights = new Map<string, number>();

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

    let y = 0;

    const spine = this.spineCards();
    spine.forEach((card, index) => {
      const height = this.estimateCardHeight(card, 'spine');
      heights.set(card.id, height);
      nodes.push(this.toNode(card, 'spine', 0, y));
      if (index > 0) addEdge(spine[index - 1].id, card.id);
      y += height + this.VERTICAL_GAP;
    });

    const lastSpineId = spine.at(-1)?.id ?? null;

    const contradiction = this.contradictionCard();
    const branches = contradiction ? [contradiction] : [];
    if (branches.length) {
      let rowHeight = 0;
      branches.forEach((card, index) => {
        const height = this.estimateCardHeight(card, 'mechanism');
        heights.set(card.id, height);
        rowHeight = Math.max(rowHeight, height);
        const x = (index - (branches.length - 1) / 2) * this.BRANCH_COLUMN_GAP;
        nodes.push(this.toNode(card, 'mechanism', x, y));
        if (lastSpineId) addEdge(lastSpineId, card.id);
      });
      y += rowHeight + this.VERTICAL_GAP;
    }

    const candidates = this.candidateCards();
    if (candidates.length) {
      let rowHeight = 0;
      candidates.forEach((card, index) => {
        const variant: RunCardVariant = card.best ? 'best' : 'candidate';
        const height = this.estimateCardHeight(card, variant);
        heights.set(card.id, height);
        rowHeight = Math.max(rowHeight, height);
        const x = (index - (candidates.length - 1) / 2) * this.CANDIDATE_COLUMN_GAP;
        nodes.push(this.toNode(card, variant, x, y));
        const parent =
          card.sourceId?.startsWith('T') && contradiction
            ? contradiction.id
            : lastSpineId;
        if (parent) addEdge(parent, card.id);
      });
      y += rowHeight + this.VERTICAL_GAP;
    }

    const finalCard = this.finalCard();
    if (finalCard) {
      heights.set(finalCard.id, this.estimateCardHeight(finalCard, 'terminal'));
      nodes.push(this.toNode(finalCard, 'terminal', 0, y));
      const parents = candidates.length
        ? candidates
        : branches.length
          ? branches
          : lastSpineId
            ? [{ id: lastSpineId }]
            : [];
      parents.forEach((parent) => addEdge(parent.id, finalCard.id));
    }

    return { nodes, edges, heights };
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
        method: card.method,
        table: card.table,
      },
    };
  }

  private compactText(text: string, maxLength: number): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    return normalized.length > maxLength
      ? `${normalized.slice(0, maxLength - 1)}…`
      : normalized;
  }

  private readonly logScroll =
    viewChild<ElementRef<HTMLElement>>('logScroll');
  private stickToBottom = true;
  private diagramReady = false;
  private viewportFitScheduled = false;
  private pendingFit = false;
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
    const { nodes, heights } = this.graph();
    const latest = nodes.at(-1);
    const host = this.diagramHost()?.nativeElement;
    if (!latest || !host) return;

    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;

    const scale = this.FOLLOW_SCALE;
    const cardHeight = heights.get(latest.id) ?? 190;
    const centerX = latest.position.x + this.nodeWidth(latest.data.variant) / 2;
    const centerY = latest.position.y + cardHeight / 2;
    const x = width / 2 - centerX * scale;
    const y = height / 2 - centerY * scale;

    try {
      this.viewportService.setViewport(x, y, scale);
    } catch {
      // viewport not ready yet
    }
  }

  private nodeWidth(variant: RunCardVariant): number {
    return variant === 'candidate' || variant === 'best'
      ? this.COMPACT_CARD_WIDTH
      : this.WIDE_CARD_WIDTH;
  }

  onLogScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.stickToBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }

  constructor() {
    effect(() => {
      const { nodes, edges } = this.graph();
      this.model.updateNodes((current) => {
        const byId = new Map(current.map((node) => [node.id, node]));
        return nodes.map((node) => {
          const existing = byId.get(node.id);
          return existing ? { ...existing, data: node.data } : node;
        });
      });
      this.model.updateEdges(() => edges);
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
      const prompt = this.prompt();
      if (!prompt || prompt.id === this.activeRunId) return;

      this.activeRunId = prompt.id;
      this.runEvents.set([]);
      this.streamError.set(null);

      const savedRun = prompt.runs?.find((run) => run.status !== 'running');
      if (savedRun) {
        this.promptApi
          .getRunEvents(prompt.id, savedRun.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (events) => {
              if (events.length) {
                this.runEvents.set(events);
              } else {
                this.startRunStream(prompt.id);
              }
            },
            error: () => this.startRunStream(prompt.id),
          });
        return;
      }

      this.startRunStream(prompt.id);
    });
  }

  private startRunStream(promptId: string): void {
    this.promptApi
      .streamPromptRun(promptId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => this.runEvents.update((events) => [...events, event]),
        error: () =>
          this.streamError.set('Strumien przebiegu promptu zostal nieoczekiwanie rozlaczony.'),
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
          message: `Problem odebrany przez ai-agent: ${event.payload.problem ?? ''}`,
        },
        ...(event.payload.functionQuery
          ? [
              {
                id: `${event.id}-query`,
                time,
                type: event.type,
                tone,
                message: `Zapytanie funkcji: ${event.payload.functionQuery}`,
              },
            ]
          : []),
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
            'Najwyzszy ranking: ' +
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
            `Ocena rozwiazania ${evaluation?.overallScore ?? 0}/100 - ${evaluation?.verdict ?? ''} ` +
            (evaluation?.candidateScores ?? [])
              .map((score) => `[${score.id}] ${score.score}/100`)
              .join('; '),
        },
      ];
    }

    if (event.type === 'run_cost') {
      const cost = event.payload.cost;
      return [
        {
          id: event.id,
          time,
          type: event.type,
          tone,
          message: cost
            ? `Szacowany koszt ${this.formatCost(cost.totalCostUsd)} dla ${cost.totalTokens} tokenow w modelu ${cost.model}.`
            : event.message,
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

  protected formatLogType(type: string): string {
    switch (type) {
      case 'prompt':
        return 'prompt';
      case 'run_started':
        return 'start przebiegu';
      case 'function_query':
        return 'zapytanie funkcji';
      case 'database_loaded':
        return 'baza danych';
      case 'vectorized':
        return 'wektoryzacja';
      case 'ranking':
        return 'ranking';
      case 'mechanism_selected':
        return 'wybor mechanizmu';
      case 'contradiction_found':
        return 'sprzecznosc';
      case 'candidate':
        return 'kandydat';
      case 'scored':
        return 'ocena';
      case 'run_cost':
        return 'koszt przebiegu';
      case 'run_completed':
        return 'zakonczono';
      case 'error':
        return 'blad';
      default:
        return type;
    }
  }

  private eventTone(type: string): LogTone {
    switch (type) {
      case 'error':
        return 'error';
      case 'run_completed':
      case 'candidate':
      case 'scored':
      case 'run_cost':
        return 'success';
      case 'mechanism_selected':
      case 'ranking':
      case 'contradiction_found':
        return 'warn';
      case 'run_started':
      case 'function_query':
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

  protected formatCost(cost: number): string {
    return `$${cost.toFixed(cost >= 0.01 ? 4 : 6)}`;
  }
}

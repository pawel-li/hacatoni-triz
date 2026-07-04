import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { PromptApiService } from '../../data/prompt-api.service';
import { Prompt, PromptRunEvent } from '../../data/types';

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

type RunLogEntry = {
  id: string;
  timestamp: string;
  type: string;
  message: string;
};

@Component({
  selector: 'app-prompt-diagram-page',
  imports: [RouterModule],
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
        <div class="diagram-panel" aria-label="Live prompt diagram">
          <div class="diagram-spine" aria-label="Notebook pipeline stages">
            @for (card of spineCards(); track card.id) {
              <article class="diagram-card diagram-card--spine">
                <p class="diagram-card__stage">{{ card.stage }}</p>
                <h2>{{ card.title }}</h2>
                <p class="diagram-card__subtitle">{{ card.subtitle }}</p>
                @if (card.detail) {
                  <p class="diagram-card__detail">{{ card.detail }}</p>
                }
                @if (card.meta) {
                  <p class="diagram-card__meta">{{ card.meta }}</p>
                }
              </article>
            }
          </div>

          @if (mechanismCards().length) {
            <section class="diagram-fanout" aria-label="Selected biomimicry mechanisms">
              <p class="diagram-section-label">Selected mechanisms</p>
              <div class="diagram-grid">
                @for (card of mechanismCards(); track card.id) {
                  <article class="diagram-card diagram-card--mechanism">
                    <p class="diagram-card__stage">{{ card.stage }}</p>
                    <h3>{{ card.title }}</h3>
                    <p class="diagram-card__subtitle">{{ card.subtitle }}</p>
                    <p class="diagram-card__detail">{{ card.detail }}</p>
                  </article>
                }
              </div>
            </section>
          }

          @if (candidateCards().length) {
            <section class="diagram-fanout" aria-label="Generated concept candidates">
              <p class="diagram-section-label">Generated candidates</p>
              <div class="diagram-grid">
                @for (card of candidateCards(); track card.id) {
                  <article class="diagram-card diagram-card--candidate">
                    <div class="diagram-card__header-row">
                      <p class="diagram-card__stage">{{ card.stage }}</p>
                      @if (card.badge) {
                        <span class="diagram-card__badge">{{ card.badge }}</span>
                      }
                    </div>
                    <h3>{{ card.title }}</h3>
                    <p class="diagram-card__subtitle">{{ card.subtitle }}</p>
                    <p class="diagram-card__detail">{{ card.detail }}</p>
                  </article>
                }
              </div>
            </section>
          }

          @if (finalCard(); as card) {
            <article class="diagram-card diagram-card--terminal">
              <p class="diagram-card__stage">{{ card.stage }}</p>
              <h2>{{ card.title }}</h2>
              <p class="diagram-card__subtitle">{{ card.subtitle }}</p>
              <p class="diagram-card__detail">{{ card.detail }}</p>
            </article>
          }
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

    .diagram-panel {
      min-height: 68dvh;
      max-height: 76dvh;
      overflow: auto;
      border: 1px dotted rgb(239 232 218 / 55%);
      padding: 24px;
      background:
        linear-gradient(rgb(239 232 218 / 5%) 1px, transparent 1px),
        linear-gradient(90deg, rgb(239 232 218 / 5%) 1px, transparent 1px);
      background-size: 28px 28px;
    }

    .diagram-spine {
      display: grid;
      justify-items: center;
      gap: 26px;
      position: relative;
    }

    .diagram-spine::before {
      content: '';
      position: absolute;
      top: 34px;
      bottom: 34px;
      width: 1px;
      border-left: 1px dotted rgb(239 232 218 / 45%);
    }

    .diagram-card {
      width: min(100%, 520px);
      border: 1px dotted rgb(17 19 18 / 75%);
      background: #f4f2e8;
      color: #111312;
      padding: 18px 20px;
      position: relative;
      box-shadow: 0 18px 34px rgb(0 0 0 / 38%);
    }

    .diagram-card--spine {
      z-index: 1;
    }

    .diagram-card--mechanism {
      background: #f7efd0;
    }

    .diagram-card--candidate {
      background: #e7f0e2;
    }

    .diagram-card--terminal {
      margin: 28px auto 0;
      background: #dfe8f0;
    }

    .diagram-card__header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .diagram-card__stage,
    .diagram-section-label,
    .diagram-card__badge {
      margin: 0;
      font-size: 0.67rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgb(17 19 18 / 58%);
    }

    .diagram-card__badge {
      border: 1px dotted rgb(17 19 18 / 45%);
      padding: 2px 7px;
      white-space: nowrap;
    }

    .diagram-card h2,
    .diagram-card h3 {
      margin: 8px 0 0;
      font-family: 'Russo One', sans-serif;
      font-size: 1rem;
      line-height: 1.3;
    }

    .diagram-card__subtitle,
    .diagram-card__detail,
    .diagram-card__meta {
      margin: 8px 0 0;
      font-size: 0.84rem;
      line-height: 1.45;
      color: rgb(17 19 18 / 72%);
    }

    .diagram-card__detail {
      max-height: 6.6em;
      overflow: auto;
      color: rgb(17 19 18 / 82%);
    }

    .diagram-card__meta {
      font-weight: 700;
      color: rgb(17 19 18 / 55%);
    }

    .diagram-fanout {
      margin-top: 34px;
      border-top: 1px dotted rgb(239 232 218 / 35%);
      padding-top: 18px;
    }

    .diagram-section-label {
      color: rgb(239 232 218 / 58%);
      margin-bottom: 14px;
    }

    .diagram-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 16px;
      align-items: stretch;
    }

    .diagram-grid .diagram-card {
      width: 100%;
      min-height: 190px;
    }
  `,
})
export class PromptDiagramPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly promptApi = inject(PromptApiService);
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
  readonly logs = computed<RunLogEntry[]>(() =>
    [
      ...(this.promptText()
        ? [
            {
              id: 'loaded-prompt',
              timestamp: '',
              type: 'prompt',
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

    const completedEvent = this.completedEvent();
    if (!completedEvent) return null;

    const trail = completedEvent.payload.reasoningTrail;
    return {
      id: 'reasoning-trail',
      stage: '08 reasoning trail',
      title: 'Reasoning trail',
      subtitle: `method: ${trail?.method ?? 'biomimicry'}`,
      detail: `${trail?.selected_mechanisms.length ?? 0} mechanisms selected · ${
        trail?.candidates.length ?? 0
      } candidates generated`,
    };
  });

  constructor() {
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
    if (event.type === 'run_started') {
      return [
        {
          id: `${event.id}-problem`,
          timestamp: event.timestamp,
          type: event.type,
          message: `Problem received by ai-agent: ${event.payload.problem ?? ''}`,
        },
        {
          id: `${event.id}-query`,
          timestamp: event.timestamp,
          type: event.type,
          message: `Function query: ${event.payload.functionQuery ?? ''}`,
        },
      ];
    }

    if (event.type === 'ranking') {
      return [
        {
          id: event.id,
          timestamp: event.timestamp,
          type: event.type,
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
          timestamp: event.timestamp,
          type: event.type,
          message: `[${event.payload.candidate?.id}] ${event.payload.candidate?.tytul} - ${event.payload.candidate?.opis}`,
        },
      ];
    }

    return [
      {
        id: event.id,
        timestamp: event.timestamp,
        type: event.type,
        message: event.message,
      },
    ];
  }
}

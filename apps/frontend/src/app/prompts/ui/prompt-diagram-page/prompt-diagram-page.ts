import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  NgDiagramComponent,
  NgDiagramNodeTemplateMap,
  initializeModel,
  provideNgDiagram,
} from 'ng-diagram';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { PromptNodeComponent } from '../../../diagram/ui/prompt-node/prompt-node';
import { PromptApiService } from '../../data/prompt-api.service';
import { Prompt } from '../../data/types';

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
    <div class="flex min-h-dvh flex-col bg-[#0f1110] text-[#efe8da]" aria-label="Prompt Page">
      <header class="border-b border-[#efe8da]/10 px-6 py-4 sm:px-8">
        <div class="mx-auto flex w-full max-w-7xl items-center gap-4">
          <a
            routerLink="/"
            class="text-sm text-[#efe8da]/70 transition hover:text-[#efe8da]"
            aria-label="Back to home"
          >
            ← Back
          </a>
          <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 class="font-soviet m-0 text-lg font-semibold tracking-wide text-[#efe8da] sm:text-xl">
              Prompt Run
            </h1>
            <p class="m-0 text-xs uppercase tracking-[0.16em] text-[#efe8da]/40">
              diagram + backend stream
            </p>
          </div>
        </div>
      </header>

      <main class="grid flex-1 gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.42fr)] lg:px-8">
        <section class="diagram-panel" aria-label="Prompt diagram">
          <div class="panel-header">
            <span class="panel-kicker">ng-diagram</span>
            <span class="status-pill">1 node</span>
          </div>

          <div class="diagram-surface">
            <ng-diagram
              [model]="diagramModel"
              [nodeTemplateMap]="nodeTemplateMap"
            />
          </div>
        </section>

        <aside class="logs-panel" aria-label="Backend event stream">
          <div class="panel-header">
            <span class="panel-kicker">backend sse</span>
            <span class="status-pill status-pill--live">standby</span>
          </div>

          <div class="logs-terminal" aria-live="polite">
            <div class="terminal-topbar" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <ol class="log-lines">
              <li><time>12:04:18.021</time><span class="log-level log-level--info">INFO</span><span>connected to prompt run stream</span></li>
              <li><time>12:04:18.184</time><span class="log-level log-level--ok">OK</span><span>route param resolved: prompt id accepted</span></li>
              <li><time>12:04:18.439</time><span class="log-level log-level--info">INFO</span><span>awaiting backend SSE events</span></li>
              <li><time>12:04:19.002</time><span class="log-level log-level--trace">TRACE</span><span>diagram node rendered from prompt payload</span></li>
              <li><time>12:04:19.416</time><span class="log-level log-level--warn">WAIT</span><span>worker queue idle, no live logs attached yet</span></li>
              <li><time>12:04:20.000</time><span class="log-level log-level--ok">READY</span><span>stream adapter placeholder online</span></li>
            </ol>
          </div>
        </aside>
      </main>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background: #0f1110;
    }

    .diagram-panel,
    .logs-panel {
      min-height: 0;
      border: 1px solid rgba(239, 232, 218, 0.12);
      background:
        linear-gradient(180deg, rgba(244, 242, 232, 0.055), rgba(244, 242, 232, 0.018)),
        #141716;
      box-shadow: 0 18px 48px rgb(0 0 0 / 38%);
    }

    .diagram-panel {
      display: flex;
      flex-direction: column;
      min-height: min(68dvh, 760px);
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-height: 52px;
      border-bottom: 1px solid rgba(239, 232, 218, 0.1);
      padding: 0 18px;
    }

    .panel-kicker,
    .status-pill {
      font-size: 0.69rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .panel-kicker {
      color: rgba(239, 232, 218, 0.58);
    }

    .status-pill {
      border: 1px solid rgba(47, 133, 182, 0.48);
      background: rgba(47, 133, 182, 0.13);
      color: #95d5f7;
      padding: 5px 9px;
    }

    .status-pill--live {
      border-color: rgba(82, 173, 122, 0.42);
      background: rgba(82, 173, 122, 0.13);
      color: #9ee6ba;
    }

    .diagram-surface {
      position: relative;
      flex: 1;
      min-height: 520px;
      overflow: hidden;
      background:
        linear-gradient(rgba(239, 232, 218, 0.055) 1px, transparent 1px),
        linear-gradient(90deg, rgba(239, 232, 218, 0.055) 1px, transparent 1px),
        radial-gradient(circle at 48% 42%, rgba(47, 133, 182, 0.16), transparent 32%),
        #0f1110;
      background-size: 32px 32px, 32px 32px, auto, auto;
    }

    .diagram-surface ng-diagram {
      display: block;
      width: 100%;
      height: 100%;
    }

    .logs-panel {
      display: flex;
      flex-direction: column;
      min-height: 360px;
      overflow: hidden;
    }

    .logs-terminal {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
      margin: 14px;
      border: 1px solid rgba(158, 230, 186, 0.18);
      background: #070908;
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 3%);
    }

    .terminal-topbar {
      display: flex;
      gap: 7px;
      border-bottom: 1px solid rgba(158, 230, 186, 0.14);
      padding: 10px 12px;
    }

    .terminal-topbar span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #2f85b6;
      opacity: 0.85;
    }

    .terminal-topbar span:nth-child(2) {
      background: #d7b45a;
    }

    .terminal-topbar span:nth-child(3) {
      background: #52ad7a;
    }

    .log-lines {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 16px;
      overflow: auto;
      list-style: none;
      font-family: 'Cascadia Code', 'Consolas', monospace;
      font-size: 0.76rem;
      line-height: 1.55;
      color: rgba(239, 232, 218, 0.82);
    }

    .log-lines li {
      display: grid;
      grid-template-columns: 88px 52px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      min-width: 0;
    }

    .log-lines time {
      color: rgba(239, 232, 218, 0.38);
    }

    .log-level {
      font-weight: 700;
      color: #95d5f7;
    }

    .log-level--ok {
      color: #9ee6ba;
    }

    .log-level--warn {
      color: #d7b45a;
    }

    .log-level--trace {
      color: #c5b7ff;
    }

    @media (max-width: 1023px) {
      .diagram-panel {
        min-height: 560px;
      }
    }

    @media (max-width: 640px) {
      .diagram-surface {
        min-height: 460px;
      }

      .log-lines li {
        grid-template-columns: 1fr;
        gap: 2px;
      }
    }
  `,
})
export class PromptDiagramPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly promptApi = inject(PromptApiService);

  readonly nodeTemplateMap = new NgDiagramNodeTemplateMap([
    ['prompt', PromptNodeComponent],
  ]);

  readonly diagramModel = initializeModel({
    nodes: [
      {
        id: 'prompt-node',
        type: 'prompt',
        position: { x: 260, y: 180 },
        data: {
          label: 'Prompt payload ready for processing',
          subtitle: 'Source node for TRIZ processing and backend SSE log attachment',
        },
        draggable: true,
      },
    ],
    edges: [],
  });

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
}

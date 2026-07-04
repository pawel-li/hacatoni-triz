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
        class="mx-auto mt-4 flex min-h-[60dvh] w-full max-w-6xl flex-1 flex-col border border-dotted border-[#efe8da]/55"
        aria-label="Prompt diagram"
      >
        <ng-diagram
          class="block h-full w-full flex-1"
          [model]="diagramModel"
          [nodeTemplateMap]="nodeTemplateMap"
        />
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

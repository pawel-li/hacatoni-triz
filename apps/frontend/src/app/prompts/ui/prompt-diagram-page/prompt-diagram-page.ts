import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TrizzCardComponent } from '@nw/trizz-card';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { PromptApiService } from '../../data/prompt-api.service';
import { Prompt } from '../../data/types';

type PromptPageState = {
  loading: boolean;
  error: string | null;
  prompt: Prompt | null;
};

@Component({
  selector: 'app-prompt-diagram-page',
  imports: [RouterModule, TrizzCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-dvh bg-[#0f1110] text-zinc-100" aria-label="Prompt Page">
      <header class="px-6 py-4 sm:px-8">
        <div class="mx-auto flex w-full max-w-3xl items-center gap-4">
          <a
            routerLink="/"
            class="text-sm text-[#efe8da]/70 transition hover:text-[#efe8da]"
            aria-label="Back to home"
          >
            ← Back
          </a>
          <h1 class="text-lg font-semibold tracking-wide text-[#efe8da] sm:text-xl">
            Prompt
          </h1>
        </div>
      </header>

      <main class="grid place-items-center px-4 pb-8 pt-4 sm:pt-8">
        <nw-trizz-card [contentOnly]="true">
          <p class="h-full overflow-y-auto whitespace-pre-wrap text-[0.95rem] leading-7 text-[#111312]" aria-live="polite">
            @if (loading()) {
              Loading prompt...
            } @else if (error()) {
              {{ error() }}
            } @else {
              {{ promptText() }}
            }
          </p>
        </nw-trizz-card>
      </main>
    </div>
  `,
})
export class PromptDiagramPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly promptApi = inject(PromptApiService);

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

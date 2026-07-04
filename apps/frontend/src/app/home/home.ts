import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TrizzCardComponent } from '@nw/trizz-card';
import { PromptApiService } from '../prompts/data/prompt-api.service';

@Component({
  selector: 'app-home',
  imports: [TrizzCardComponent, FormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      class="flex min-h-dvh flex-col bg-[#0f1110] px-4 pb-8 pt-4 text-[#efe8da] sm:px-8 lg:grid lg:h-dvh lg:grid-cols-2 lg:items-center lg:overflow-hidden lg:px-12 lg:pb-6"
      aria-label="Home"
    >
      <section class="flex min-h-0 w-full flex-1 items-center justify-center py-2" aria-label="Prompt form">
        <nw-trizz-card>
          <!-- Prompt form -->
          <form
            class="mt-6 flex flex-col gap-3 w-full"
            (ngSubmit)="onSubmit()"
            aria-label="Submit a problem prompt"
          >
   

            <textarea
              id="prompt-input"
              name="promptText"
              [(ngModel)]="promptText"
              rows="3"
              [disabled]="submitting()"
              placeholder="Wklej swój problem"
              class="w-full resize-none rounded-none border border-dotted border-[rgba(17,19,18,0.35)] bg-transparent px-4 py-3 text-sm text-[#111312] font-['Inter'] placeholder:text-[rgba(17,19,18,0.45)] focus:border-[rgba(17,19,18,0.7)] focus:outline-none transition-colors duration-200 disabled:opacity-40"
              aria-required="true"
            ></textarea>

            @if (errorMsg()) {
              <p class="text-[#a43f3f] text-xs font-['Inter']" role="alert">{{ errorMsg() }}</p>
            }

            <button
              type="submit"
              id="submit-prompt-btn"
              [disabled]="submitting() || !promptText().trim()"
              class="flex items-center justify-center gap-2 rounded-none border border-dotted border-[#111312] bg-[#111312] px-6 py-3 text-[0.78rem] tracking-widest text-[#efe8da] font-['Russo_One'] uppercase transition-all duration-200 hover:bg-[#060706] hover:border-[#060706] hover:text-[#f7f0e2] disabled:opacity-35 disabled:cursor-not-allowed"
              aria-label="Analyse prompt with TRIZ"
            >
              @if (submitting()) {
                <span class="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                Saving…
              } @else {
                ROZWIAZUJ →
              }
            </button>
          </form>
        </nw-trizz-card>
      </section>

      <nav
        class="mx-auto mt-6 flex w-full max-w-[420px] flex-col gap-3 sm:max-w-[640px] sm:flex-row lg:mt-0 lg:max-w-[300px] lg:flex-col lg:items-stretch"
        aria-label="Main menu"
      >
        <a
          routerLink="/prompts"
          class="border border-dotted border-[#efe8da]/55 px-5 py-4 text-center text-sm font-bold uppercase tracking-[0.08em] text-[#efe8da] transition hover:border-[#efe8da] hover:bg-[#efe8da]/10 focus:outline-none focus:ring-4 focus:ring-[#efe8da]/35 sm:flex-1 lg:text-left"
        >
          Prompts
        </a>
        <a
          routerLink="/about"
          class="border border-dotted border-[#efe8da]/55 px-5 py-4 text-center text-sm font-bold uppercase tracking-[0.08em] text-[#efe8da] transition hover:border-[#efe8da] hover:bg-[#efe8da]/10 focus:outline-none focus:ring-4 focus:ring-[#efe8da]/35 sm:flex-1 lg:text-left"
        >
          O nas
        </a>
        <a
          href="https://github.com/pawel-li/hacatoni-triz"
          target="_blank"
          rel="noreferrer"
          class="border border-dotted border-[#efe8da]/55 px-5 py-4 text-center text-sm font-bold uppercase tracking-[0.08em] text-[#efe8da] transition hover:border-[#efe8da] hover:bg-[#efe8da]/10 focus:outline-none focus:ring-4 focus:ring-[#efe8da]/35 sm:flex-1 lg:text-left"
          aria-label="Open BioTRIZZER GitHub repository in a new tab"
        >
          GitHub
        </a>
      </nav>
    </main>
  `,
})
export class HomeComponent {
  private readonly promptApi = inject(PromptApiService);
  private readonly router = inject(Router);

  readonly promptText = signal('');
  readonly submitting = signal(false);
  readonly errorMsg = signal<string | null>(null);

  onSubmit(): void {
    const text = this.promptText().trim();
    if (!text || this.submitting()) return;

    this.submitting.set(true);
    this.errorMsg.set(null);

    this.promptApi.createPrompt(text).subscribe({
      next: (prompt) => {
        this.router.navigate(['/prompts', prompt.id]);
      },
      error: () => {
        this.errorMsg.set('Failed to save the prompt. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}

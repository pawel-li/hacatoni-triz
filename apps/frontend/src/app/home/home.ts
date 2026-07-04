import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TrizzCardComponent } from '@nw/trizz-card';
import { PromptApiService } from '../prompts/data/prompt-api.service';

@Component({
  selector: 'app-home',
  imports: [TrizzCardComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      class="grid min-h-dvh place-items-center overflow-hidden bg-[#0f1110] p-4"
      aria-label="Home"
    >
      <div class="flex flex-col items-center gap-8">
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
      </div>
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

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-about',
  imports: [RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-dvh bg-[#0f1110] px-5 py-8 text-[#efe8da] sm:px-8" aria-label="O nas">
      <div class="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col justify-center gap-8">
        <a
          routerLink="/"
          class="w-fit text-sm text-[#efe8da]/75 transition hover:text-[#efe8da] focus:outline-none focus:ring-4 focus:ring-[#efe8da]/35"
          aria-label="Back to home"
        >
          ← Back
        </a>

        <section class="border-2 border-[#efe8da] bg-[#f4f2e8] px-6 py-7 text-[#111312] shadow-[0_18px_42px_rgb(0_0_0_/_42%)] sm:px-8 sm:py-9">
          <h1 class="font-soviet m-0 text-4xl font-extrabold leading-none sm:text-5xl">
            O nas
          </h1>
          <p class="mt-5 text-base leading-7">
            BioTRIZZER pomaga zamienic problem w prompt, ktory mozna analizowac przez TRIZ i biomimikre.
            Projekt laczy prosta karte wejscia, historie promptow i dalsza prace nad diagramami rozwiazan.
          </p>
        </section>
      </div>
    </main>
  `,
})
export class AboutComponent {}
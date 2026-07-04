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

        <section class="border-2 border-[#efe8da] bg-[#f4f2e8] px-6 py-7 text-[#111312] shadow-[0_18px_42px_rgb(0_0_0_/_42%)] sm:px-8 sm:py-9" aria-labelledby="about-heading">
          <h1 id="about-heading" class="font-soviet m-0 text-4xl font-extrabold leading-none sm:text-5xl">
            O nas
          </h1>
          <p class="mt-5 text-base leading-7">
            BioTRIZZER pomaga zamienic surowy problem w prompt, a potem przeprowadza go przez dwa
            uzupelniajace sie sposoby analizy: inzynierski TRIZ oraz inspiracje z biomimikry.
          </p>
          <div class="mt-6 grid gap-4 sm:grid-cols-2">
            <article class="border-2 border-[#111312] bg-[#efe8da] p-4">
              <h2 class="m-0 text-lg font-extrabold uppercase tracking-wide">TRIZ</h2>
              <p class="mt-3 text-sm leading-6">
                Agent rozbija problem na sprzecznosci, ograniczenia i cel zmiany. Szuka zasad
                wynalazczych, ktore pomagaja przeformulowac konflikt w konkretne kierunki rozwiazania.
              </p>
            </article>
            <article class="border-2 border-[#111312] bg-[#efe8da] p-4">
              <h2 class="m-0 text-lg font-extrabold uppercase tracking-wide">Biomimikra</h2>
              <p class="mt-3 text-sm leading-6">
                Agent patrzy na ten sam problem jak na wyzwanie znane z natury: adaptacje, przeplywy,
                ochrone, wspolprace albo regeneracje. Z takich analogii wybiera tropy do dalszego
                rozwijania w diagramie.
              </p>
            </article>
          </div>
        </section>
      </div>
    </main>
  `,
})
export class AboutComponent {}
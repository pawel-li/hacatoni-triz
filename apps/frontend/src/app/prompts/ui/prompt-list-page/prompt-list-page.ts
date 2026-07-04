import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TrizzCardComponent } from '@nw/trizz-card';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { PromptApiService } from '../../data/prompt-api.service';
import { Prompt } from '../../data/types';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-prompt-list-page',
  imports: [DatePipe, FormsModule, RouterModule, TrizzCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-dvh bg-[#0f1110] text-[#efe8da]" aria-labelledby="prompts-page-title">
      <header class="px-5 pb-4 pt-5 sm:px-8">
        <div class="mx-auto flex w-full max-w-6xl flex-col gap-3">
          <div class="space-y-2">
            <a
              routerLink="/"
              class="text-sm text-[#efe8da]/70 transition hover:text-[#efe8da]"
              aria-label="Back to home"
            >
              ← Back
            </a>
            <h1
              id="prompts-page-title"
              class="font-soviet text-4xl font-extrabold leading-none text-[#efe8da] sm:text-5xl"
            >
              Prompts
            </h1>
          </div>
        </div>
      </header>

      <section class="px-5 pb-8 sm:px-8">
        <div class="mx-auto w-full max-w-6xl">
          <form
            class="w-full border border-dotted border-[#efe8da]/45 bg-[linear-gradient(135deg,rgba(239,232,218,0.08),rgba(239,232,218,0.02))] p-4 sm:p-5"
            role="search"
            aria-label="Search prompts"
            (submit)="$event.preventDefault()"
          >
            <input
              id="prompt-search"
              name="prompt-search"
              type="search"
              aria-label="Search prompts"
              [ngModel]="searchTerm()"
              (ngModelChange)="onSearchChange($event)"
              placeholder="Search"
              class="w-full rounded-none border border-dotted border-[#efe8da]/55 bg-[#0f1110]/55 px-4 py-3 text-sm text-[#efe8da] outline-none placeholder:text-[#efe8da]/55 focus:border-[#efe8da] focus:ring-4 focus:ring-[#efe8da]/15"
              autocomplete="off"
            />
          </form>
        </div>
      </section>

      <section class="mx-auto w-full max-w-6xl px-5 pb-12 sm:px-8">
        <p class="sr-only" aria-live="polite">{{ statusText() }}</p>

        @if (error()) {
          <p class="mb-5 border border-[#a43f3f] bg-[#a43f3f]/10 px-4 py-3 text-sm text-[#ffd1d1]" role="alert">
            {{ error() }}
          </p>
        }

        @if (prompts().length) {
          <section
            id="prompt-results"
            class="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 xl:grid-cols-3"
            aria-label="Prompt results"
            [attr.aria-busy]="loading() || loadingMore()"
          >
            <h2 class="sr-only">Prompt results list</h2>
            @for (prompt of prompts(); track prompt.id) {
              <nw-trizz-card [contentOnly]="true">
                <a
                  [routerLink]="['/prompts', prompt.id]"
                  [attr.aria-label]="'View prompt: ' + (prompt.text.length > 60 ? prompt.text.substring(0, 60) + '…' : prompt.text)"
                  class="block space-y-2 whitespace-pre-wrap text-[0.95rem] leading-7 text-[#111312] outline-none [overflow-wrap:anywhere] focus-visible:ring-4 focus-visible:ring-[#0b5f86]/30"
                >
                  <span class="inline-block border border-dotted border-[#111312]/45 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[#2e332f]">
                    {{ formatMethod(prompt.method) }}
                  </span>
                  <time class="block text-xs font-semibold uppercase tracking-[0.06em] text-[#3e4440]" [attr.datetime]="prompt.createdAt">
                    {{ prompt.createdAt | date: 'medium' }}
                  </time>
                  <span class="block break-words">{{ prompt.text }}</span>
                </a>
              </nw-trizz-card>
            }
          </section>
        } @else if (!loading()) {
          <p class="border border-dotted border-[#efe8da]/45 px-4 py-6 text-center text-sm text-[#efe8da]/75">
            No prompts found.
          </p>
        }

        <div #loadMoreTrigger class="h-14" aria-hidden="true"></div>

        @if (nextCursor() && !loading() && !loadingMore()) {
          <div class="mt-2 flex justify-center">
            <button
              type="button"
              class="rounded-none border border-dotted border-[#efe8da]/60 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#efe8da] transition hover:bg-[#efe8da]/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#efe8da]/25"
              (click)="loadMore()"
              aria-controls="prompt-results"
            >
              Load more prompts
            </button>
          </div>
        }

        @if (loading() || loadingMore()) {
          <p class="text-center text-sm text-[#efe8da]/70" aria-hidden="true">
            Loading prompts...
          </p>
        } @else if (!nextCursor() && prompts().length) {
          <p class="text-center text-sm text-[#efe8da]/50">
            End of prompts.
          </p>
        }
      </section>
    </main>
  `,
})
export class PromptListPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('loadMoreTrigger') private loadMoreTrigger?: ElementRef<HTMLElement>;

  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly promptApi = inject(PromptApiService);
  private readonly searchChanges = new Subject<string>();

  private observer?: IntersectionObserver;
  private requestToken = 0;

  readonly prompts = signal<Prompt[]>([]);
  readonly searchTerm = signal('');
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);

  readonly statusText = computed(() => {
    if (this.loading()) return 'Loading prompts.';
    if (this.loadingMore()) return 'Loading more prompts.';
    if (this.error()) return this.error() ?? '';
    return `${this.prompts().length} prompts loaded.`;
  });

  constructor() {
    this.searchChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => this.loadFirstPage(term));

    this.loadFirstPage('');
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.loadMoreTrigger) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.loadNextPage();
        }
      },
      { rootMargin: '320px 0px' },
    );
    this.observer.observe(this.loadMoreTrigger.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.searchChanges.next(value.trim());
  }

  loadMore(): void {
    this.loadNextPage();
  }

  formatMethod(method?: string): string {
    if (method === 'both') return 'Biomimicry + TRIZ';
    if (method === 'triz') return 'TRIZ';
    return 'Biomimicry';
  }

  private loadFirstPage(search: string): void {
    const token = ++this.requestToken;

    this.loading.set(true);
    this.loadingMore.set(false);
    this.error.set(null);
    this.nextCursor.set(null);

    this.promptApi.getPrompts({ search, take: PAGE_SIZE }).subscribe({
      next: (response) => {
        if (token !== this.requestToken) return;

        this.prompts.set(response.items);
        this.nextCursor.set(response.nextCursor);
        this.loading.set(false);
      },
      error: () => {
        if (token !== this.requestToken) return;

        this.prompts.set([]);
        this.nextCursor.set(null);
        this.error.set('Could not load prompts. Please try again.');
        this.loading.set(false);
      },
    });
  }

  private loadNextPage(): void {
    const cursor = this.nextCursor();

    if (!cursor || this.loading() || this.loadingMore()) return;

    const token = this.requestToken;
    this.loadingMore.set(true);
    this.error.set(null);

    this.promptApi
      .getPrompts({ cursor, search: this.searchTerm().trim(), take: PAGE_SIZE })
      .subscribe({
        next: (response) => {
          if (token !== this.requestToken) return;

          this.prompts.update((items) => [...items, ...response.items]);
          this.nextCursor.set(response.nextCursor);
          this.loadingMore.set(false);
        },
        error: () => {
          if (token !== this.requestToken) return;

          this.error.set('Could not load more prompts. Please try again.');
          this.loadingMore.set(false);
        },
      });
  }
}
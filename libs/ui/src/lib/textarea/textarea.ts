import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  output,
  signal,
} from '@angular/core';

let _nextId = 0;

@Component({
  selector: 'nw-textarea',
  imports: [],
  template: `
    <form
      class="my-auto mx-1 flex items-center gap-3 rounded-none border border-[#282d29] bg-[#070908] px-3 py-3 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_3%)]"
      [attr.aria-label]="submitLabel()"
      (submit)="onSubmit($event)"
    >
      <textarea
        [id]="textareaId()"
        [name]="name() || textareaId()"
        [attr.maxlength]="maxlength()"
        [placeholder]="placeholder()"
        [attr.aria-label]="placeholder()"
        [value]="value()"
        (input)="value.set($any($event.target).value)"
        class="min-h-[58px] flex-1 resize-none overflow-y-auto border-none bg-transparent px-1 py-2 text-[0.8rem] leading-tight text-[#f5f5ed] outline-none placeholder:text-[#8f958f]"
        [attr.aria-required]="required()"
      ></textarea>

      <button
        type="submit"
        class="inline-flex h-9 w-9 items-center justify-center rounded-none bg-[#2d7ff9] text-white transition-colors hover:bg-[#4690ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d7ff9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070908] disabled:cursor-not-allowed disabled:bg-[#2a3b5b] disabled:text-[#7f90a8]"
        [disabled]="!value().trim()"
        [attr.aria-label]="submitLabel()"
      >
        <svg
          viewBox="0 0 24 24"
          class="h-4 w-4"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 19V5" />
          <path d="m6 11 6-6 6 6" />
        </svg>
      </button>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextareaComponent {
  /** Placeholder text. */
  readonly placeholder = input<string>('Wklej problem');

  /** Submit button text. */
  readonly submitLabel = input<string>('Submit');

  /** Textarea value (supports two-way binding). */
  readonly value = model<string>('');

  /** Max length. */
  readonly maxlength = input<number>(500);

  /** Textarea name. */
  readonly name = input<string>();

  /** Whether the field is required. */
  readonly required = input<boolean>(true);

  /** Emits the submitted text value. */
  readonly submitted = output<string>();

  /** Unique ID for the textarea and linking the label. */
  readonly textareaId = signal(`nw-textarea-${_nextId++}`);

  onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    const text = this.value().trim();
    if (!text) {
      return;
    }

    this.submitted.emit(text);
  }
}

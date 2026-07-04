import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { CardVariant } from './types';

let _nextId = 0;

@Component({
  selector: 'nw-card',
  templateUrl: './card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  /** Primary heading displayed in the card body. */
  readonly title = input.required<string>();

  /** Optional sub-text beneath the title. */
  readonly subtitle = input<string>();

  /** Hide header and heading slots so projected content is the entire card body. */
  readonly contentOnly = input(false);

  /** Visual style variant. */
  readonly variant = input<CardVariant>('default');

  /**
   * Unique ID linking the article landmark to its heading for accessibility.
   * Generated once per component instance.
   */
  readonly headingId = signal(`nw-card-heading-${_nextId++}`);
}

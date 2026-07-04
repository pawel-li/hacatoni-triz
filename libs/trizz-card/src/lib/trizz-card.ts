import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CardComponent, TriangleCanvasComponent } from '@nw/ui';

@Component({
  selector: 'nw-trizz-card',
  imports: [CardComponent, TriangleCanvasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nw-card
      [title]="title()"
      [subtitle]="subtitle()"
      [contentOnly]="contentOnly()"
    >

      @if (!contentOnly()) {
        <!-- WebGL Sierpiński fractal fills the card header -->
        <nw-triangle-canvas card-header />
      }

      <!-- Prompt form projected by parent -->
      <ng-content />

    </nw-card>
  `,
})
export class TrizzCardComponent {
  readonly title = input('BioTRIZZER');
  readonly subtitle = input<string | undefined>();
  readonly contentOnly = input(false);
}
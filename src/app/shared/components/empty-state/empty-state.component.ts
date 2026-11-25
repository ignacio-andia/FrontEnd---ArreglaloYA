import { Component, input } from '@angular/core';

/** Estado sin resultados: título y, como contenido proyectado, la explicación o la acción. */
@Component({
  selector: 'app-empty-state',
  template: `
    <p class="empty__title">{{ heading() }}</p>
    <ng-content />
  `,
  styles: `
    @use 'tokens';

    :host {
      display: grid;
      justify-items: start;
      gap: tokens.$space-3;
      padding: tokens.$space-8 tokens.$space-6;
      border: 1px dashed var(--color-control-border);
      border-radius: tokens.$radius-lg;
      background-color: var(--color-surface);
    }

    .empty__title {
      color: var(--color-primary-dark);
      font-size: 1.125rem;
      font-weight: tokens.$font-weight-semibold;
    }
  `,
})
export class EmptyStateComponent {
  readonly heading = input.required<string>();
}

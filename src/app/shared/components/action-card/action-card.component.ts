import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Acceso destacado a una sección: toda la tarjeta es el área del enlace. */
@Component({
  selector: 'app-action-card',
  imports: [RouterLink],
  template: `
    <article class="action">
      <h3 class="action__title">
        <a class="action__link" [routerLink]="path()">{{ heading() }}</a>
      </h3>
      <p class="action__description">{{ description() }}</p>
    </article>
  `,
  styles: `
    @use 'tokens';

    :host {
      display: block;
      height: 100%;
    }

    .action {
      position: relative;
      height: 100%;
      padding: tokens.$space-6;
      border: 1px solid var(--color-border);
      border-top: 4px solid var(--color-primary);
      border-radius: tokens.$radius-lg;
      background-color: var(--color-surface);
      transition: border-color 0.15s ease;

      &:hover,
      &:focus-within {
        border-color: var(--color-primary);
      }
    }

    .action__title {
      font-size: 1.125rem;
    }

    .action__link {
      color: var(--color-primary-dark);
      text-decoration: none;

      &::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: tokens.$radius-lg;
      }

      &:hover {
        text-decoration: underline;
      }
    }

    .action__description {
      margin-top: tokens.$space-2;
      color: var(--color-text-secondary);
    }
  `,
})
export class ActionCardComponent {
  readonly heading = input.required<string>();
  readonly description = input.required<string>();
  readonly path = input.required<string>();
}

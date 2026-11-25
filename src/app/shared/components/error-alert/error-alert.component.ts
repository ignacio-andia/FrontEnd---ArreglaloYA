import { Component, input, output } from '@angular/core';

/** Error de carga de una sección, con la opción de reintentar. */
@Component({
  selector: 'app-error-alert',
  template: `
    <div class="alert" role="alert">
      <p>{{ message() }}</p>
      @if (retryable()) {
        <button type="button" class="alert__retry" (click)="retry.emit()">Reintentar</button>
      }
    </div>
  `,
  styles: `
    @use 'tokens';
    @use 'buttons';

    :host {
      display: block;
    }

    .alert {
      display: grid;
      justify-items: start;
      gap: tokens.$space-2;
      padding: tokens.$space-3 tokens.$space-4;
      border-left: 4px solid var(--color-danger);
      border-radius: tokens.$radius-sm;
      background-color: rgb(180 35 24 / 8%);
    }

    .alert__retry {
      @include buttons.secondary;
    }
  `,
})
export class ErrorAlertComponent {
  readonly message = input.required<string>();
  readonly retryable = input(true);
  readonly retry = output();
}

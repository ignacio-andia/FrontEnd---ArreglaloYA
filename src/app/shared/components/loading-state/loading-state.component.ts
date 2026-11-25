import { Component, input } from '@angular/core';

/** Indicador textual de carga, anunciado a los lectores de pantalla. */
@Component({
  selector: 'app-loading-state',
  template: `<p role="status">{{ message() }}</p>`,
  styles: `
    :host {
      display: block;
      color: var(--color-text-secondary);
    }
  `,
})
export class LoadingStateComponent {
  readonly message = input.required<string>();
}

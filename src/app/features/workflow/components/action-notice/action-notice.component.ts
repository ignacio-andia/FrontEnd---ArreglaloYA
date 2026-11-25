import { Component, ElementRef, afterRenderEffect, input, viewChild } from '@angular/core';

export interface ActionNotice {
  failed: boolean;
  messages: string[];
}

/**
 * Resultado de una acción sobre un trabajo. Recibe el foco al aparecer. Las páginas lo muestran
 * fuera de los estados de carga y error: lo que confirmó el backend sigue visible aunque falle
 * la consulta posterior.
 */
@Component({
  selector: 'app-action-notice',
  template: `
    @if (notice(); as result) {
      <div
        #box
        id="action-notice"
        tabindex="-1"
        [class]="result.failed ? 'offers__error' : 'offers__notice'"
        [attr.role]="result.failed ? 'alert' : 'status'"
      >
        @for (message of result.messages; track $index) {
          <p>{{ message }}</p>
        }
      </div>
    }
  `,
  styleUrl: '../../../offers/offer-pages.scss',
  // Sin aviso no ocupa sitio en la cuadrícula de la página.
  host: { '[style.display]': "notice() ? null : 'none'" },
})
export class ActionNoticeComponent {
  readonly notice = input.required<ActionNotice | null>();

  private readonly box = viewChild<ElementRef<HTMLElement>>('box');

  constructor() {
    afterRenderEffect(() => {
      if (this.notice() !== null) {
        this.box()?.nativeElement.focus();
      }
    });
  }
}

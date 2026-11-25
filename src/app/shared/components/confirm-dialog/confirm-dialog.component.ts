import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

/**
 * Confirmación modal de una acción delicada, sobre `<dialog>`: el navegador retiene el foco,
 * cierra con Escape y devuelve el foco al cerrar. La explicación se proyecta como contenido.
 * El llamador controla `open` y realiza la acción al recibir `confirmed`.
 */
@Component({
  selector: 'app-confirm-dialog',
  template: `
    <dialog
      #dialog
      class="dialog"
      [attr.aria-labelledby]="titleId()"
      (cancel)="onCancel($event)"
      (close)="onClose()"
    >
      <h2 class="dialog__title" [id]="titleId()">{{ heading() }}</h2>
      <div class="dialog__body"><ng-content /></div>
      <div class="dialog__actions">
        <button
          type="button"
          class="dialog__cancel"
          autofocus
          [disabled]="busy()"
          (click)="cancelled.emit()"
        >
          {{ dismissLabel() }}
        </button>
        <button
          type="button"
          class="dialog__confirm"
          [class.dialog__confirm--primary]="tone() === 'primary'"
          [disabled]="busy()"
          (click)="confirmed.emit()"
        >
          {{ busy() ? busyLabel() : confirmLabel() }}
        </button>
      </div>
    </dialog>
  `,
  styleUrl: './confirm-dialog.component.scss',
  host: {
    '(keydown.escape)': 'onCancel($event)',
  },
})
export class ConfirmDialogComponent {
  readonly open = input.required<boolean>();
  readonly heading = input.required<string>();
  readonly confirmLabel = input.required<string>();
  /** Texto del botón que cierra sin hacer nada. */
  readonly dismissLabel = input('Cancelar');
  /** `danger` para acciones destructivas; `primary` para las que no destruyen nada. */
  readonly tone = input<'danger' | 'primary'>('danger');
  readonly busyLabel = input('Procesando…');
  readonly busy = input(false);
  readonly titleId = input('confirm-dialog-title');

  readonly confirmed = output();
  readonly cancelled = output();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      const open = this.open();
      if (open === element.hasAttribute('open')) {
        return;
      }
      // Sin soporte de `showModal` (entorno de pruebas) se usa solo el atributo `open`.
      if (typeof element.showModal !== 'function') {
        element.toggleAttribute('open', open);
      } else if (open) {
        element.showModal();
      } else {
        element.close();
      }
    });
  }

  /** Escape: el cierre lo decide el llamador; mientras la acción está en curso se ignora. */
  protected onCancel(event: Event): void {
    event.preventDefault();
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }

  /** Cierre iniciado por el navegador: el llamador debe dejar de considerarlo abierto. */
  protected onClose(): void {
    if (this.open()) {
      this.cancelled.emit();
    }
  }
}

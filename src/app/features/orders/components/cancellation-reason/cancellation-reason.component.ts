import { Component, ElementRef, computed, input, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SERVER_FIELD_MESSAGE, setServerError } from '../../../../shared/utils/server-validation';
import { trimmedMaxLength, trimmedRequired } from '../../../../shared/validators/text.validators';
import { ORDER_CANCEL_REASON_MAX_LENGTH } from '../../validators/order.validators';

const REQUIRED_ERROR = 'Indique el motivo de la cancelación.';
const LENGTH_ERROR = `El motivo admite hasta ${ORDER_CANCEL_REASON_MAX_LENGTH} caracteres.`;

/**
 * Motivo de una cancelación, para las dos operaciones (#51 y #90): obligatorio, de 1 a 500
 * caracteres una vez recortado. Quien lo usa lo lee con `read()` al confirmar.
 */
@Component({
  selector: 'app-cancellation-reason',
  imports: [ReactiveFormsModule],
  template: `
    @let current = state();
    <div class="field">
      <label class="field__label" [for]="fieldId()">Motivo de la cancelación</label>
      <textarea
        #textarea
        class="field__input"
        rows="3"
        required
        [id]="fieldId()"
        [formControl]="control"
        [attr.aria-invalid]="current.error ? 'true' : null"
        [attr.aria-describedby]="fieldId() + '-hint'"
      ></textarea>
      <!-- El error ocupa el lugar de la ayuda: el diálogo no se mueve al salir del campo. -->
      <p
        [id]="fieldId() + '-hint'"
        [class]="current.error ? 'field__error reason__help' : 'field__hint reason__help'"
      >
        <span>{{ current.error ?? 'Obligatorio, hasta ' + maxLength + ' caracteres.' }}</span>
        <span aria-hidden="true">{{ current.length }} / {{ maxLength }}</span>
      </p>
    </div>
  `,
  styles: `
    @use 'tokens';
    @use 'form-controls';

    @include form-controls.base;
    @include form-controls.textarea;

    :host {
      display: block;
    }

    .reason__help {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: tokens.$space-2;
    }
  `,
})
export class CancellationReasonComponent {
  readonly fieldId = input.required<string>();

  protected readonly maxLength = ORDER_CANCEL_REASON_MAX_LENGTH;
  protected readonly control = new FormControl('', {
    nonNullable: true,
    validators: [trimmedRequired, trimmedMaxLength(ORDER_CANCEL_REASON_MAX_LENGTH)],
  });
  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');
  /** Valor, errores y «tocado» del control, como señal para la plantilla. */
  private readonly changes = toSignal(this.control.events);

  protected readonly state = computed(() => {
    this.changes();
    const { errors, touched, value } = this.control;
    // El exceso de longitud se avisa mientras se escribe; el resto, tras salir o confirmar.
    const error = errors?.['maxlength']
      ? LENGTH_ERROR
      : !touched
        ? null
        : errors?.['server']
          ? SERVER_FIELD_MESSAGE
          : errors?.['required']
            ? REQUIRED_ERROR
            : null;
    return { error, length: value.trim().length };
  });

  /** Motivo recortado; si no es válido marca el error, lleva el foco al campo y devuelve `null`. */
  read(): string | null {
    if (this.control.invalid) {
      this.showError();
      return null;
    }
    return this.control.value.trim();
  }

  /** El backend rechazó el motivo (400). */
  reject(): void {
    setServerError(this.control, SERVER_FIELD_MESSAGE);
    this.showError();
  }

  /** Al volver a abrir la confirmación no se arrastra el aviso de la vez anterior. */
  clearWarning(): void {
    this.control.markAsUntouched();
  }

  private showError(): void {
    this.control.markAsTouched();
    this.textarea().nativeElement.focus();
  }
}

import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { STALE_ACTION_STATUSES } from '../../../workflow/models/workflow.model';
import { WorkflowApiService } from '../../../workflow/services/workflow-api.service';

const SEND_ERROR = 'No se pudo confirmar el cobro. Inténtelo de nuevo más tarde.';

/**
 * «Pago confirmado» de la visita (#84): el trabajador confirma que cobró en efectivo el monto
 * acordado. No es la declaración del cliente y no cambia el estado del pedido.
 */
@Component({
  selector: 'app-confirm-visit-payment',
  imports: [ConfirmDialogComponent],
  template: `
    <button type="button" class="collect" [disabled]="sending() || sent()" (click)="ask()">
      {{ sent() ? 'Actualizando…' : 'Confirmar cobro de la visita' }}
    </button>

    <app-confirm-dialog
      heading="¿Confirmar el cobro de la visita?"
      confirmLabel="Sí, recibí el pago"
      dismissLabel="Volver"
      tone="primary"
      titleId="visit-payment-title"
      [open]="confirming()"
      [busy]="sending()"
      (confirmed)="confirm()"
      (cancelled)="confirming.set(false)"
    >
      <p>
        Confirmará que recibió <strong>Bs {{ amount() }}</strong> en efectivo por la visita.
      </p>
      <p>
        La confirmación no se edita ni se borra y no cambia el estado del pedido. La plataforma no
        recibe, retiene ni garantiza el dinero.
      </p>
    </app-confirm-dialog>
  `,
  styles: `
    @use 'buttons';

    .collect {
      @include buttons.primary;
    }
  `,
})
export class ConfirmVisitPaymentComponent {
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly orderId = input.required<string>();
  /** Costo acordado de la visita, como lo registró el backend. */
  readonly amount = input.required<string>();

  readonly collected = output();
  /** Mensajes de una confirmación rechazada; vacío al volver a intentarlo. */
  readonly failed = output<string[]>();
  /** Lo mostrado puede estar desactualizado. */
  readonly stale = output();

  protected readonly confirming = signal(false);
  protected readonly sending = signal(false);
  /** Ya se confirmó: no se vuelve a enviar mientras se actualizan los pagos. */
  protected readonly sent = signal(false);

  protected ask(): void {
    this.failed.emit([]);
    this.confirming.set(true);
  }

  protected confirm(): void {
    if (this.sending() || this.sent()) {
      return;
    }
    this.sending.set(true);
    this.workflowApi
      .confirmVisitPayment(this.orderId())
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.confirming.set(false);
          this.sent.set(true);
          this.collected.emit();
        },
        error: (error: unknown) => {
          this.confirming.set(false);
          this.failed.emit(apiErrorMessages(error, SEND_ERROR));
          if (STALE_ACTION_STATUSES.includes(apiErrorStatus(error) ?? 0)) {
            this.stale.emit();
          }
        },
      });
  }
}

import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { trimmedMaxLength } from '../../../../shared/validators/text.validators';
import { OwnerOrder } from '../../models/order.model';
import { OrdersApiService } from '../../services/orders-api.service';
import { ORDER_CANCEL_REASON_MAX_LENGTH } from '../../validators/order.validators';

const CANCEL_ERROR = 'No se pudo cancelar el pedido. Inténtelo de nuevo más tarde.';

/**
 * Cancelación de un pedido sin acuerdo (`POST /orders/me/:orderId/cancel`), con confirmación y
 * motivo opcional. Se muestra solo cuando el backend indica `canCancel`. Cancelar un trabajo ya
 * acordado es otra operación y no está aquí.
 */
@Component({
  selector: 'app-cancel-order',
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './cancel-order.component.html',
  styleUrl: './cancel-order.component.scss',
})
export class CancelOrderComponent {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly orderId = input.required<string>();
  readonly cancelled = output<OwnerOrder>();
  /** El pedido mostrado puede estar desactualizado (404 o 409). */
  readonly stale = output();
  /** Mensajes del backend cuando la cancelación falla. */
  readonly failed = output<string[]>();

  protected readonly maxLength = ORDER_CANCEL_REASON_MAX_LENGTH;
  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [trimmedMaxLength(ORDER_CANCEL_REASON_MAX_LENGTH)],
  });
  protected readonly confirming = signal(false);
  protected readonly submitting = signal(false);

  protected ask(): void {
    this.failed.emit([]);
    this.confirming.set(true);
  }

  protected cancel(): void {
    if (this.submitting() || this.reason.invalid) {
      return;
    }
    const reason = this.reason.value.trim();
    this.submitting.set(true);
    this.ordersApi
      .cancel(this.orderId(), reason === '' ? {} : { reason })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (order) => {
          this.confirming.set(false);
          this.cancelled.emit(order);
        },
        error: (error: unknown) => {
          this.confirming.set(false);
          this.failed.emit(apiErrorMessages(error, CANCEL_ERROR));
          const status = apiErrorStatus(error);
          if (status === 404 || status === 409) {
            this.stale.emit();
          }
        },
      });
  }
}

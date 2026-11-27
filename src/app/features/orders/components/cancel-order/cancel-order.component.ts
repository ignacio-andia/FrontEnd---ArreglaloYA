import { Component, DestroyRef, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { OwnerOrder } from '../../models/order.model';
import { OrdersApiService } from '../../services/orders-api.service';
import { cancellationFailure } from '../../utils/cancellation-error';
import { CancellationReasonComponent } from '../cancellation-reason/cancellation-reason.component';

const CANCEL_ERROR = 'No se pudo cancelar el pedido. Inténtelo de nuevo más tarde.';

/**
 * Cancelación de un pedido sin acuerdo (`POST /orders/me/:orderId/cancel`), con motivo
 * obligatorio y confirmación. Se muestra solo cuando el backend indica `canCancel`. Cancelar un
 * trabajo ya acordado es otra operación y no está aquí.
 */
@Component({
  selector: 'app-cancel-order',
  imports: [CancellationReasonComponent, ConfirmDialogComponent],
  templateUrl: './cancel-order.component.html',
  styleUrl: './cancel-order.component.scss',
})
export class CancelOrderComponent {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly orderId = input.required<string>();
  /** El pedido se está volviendo a consultar: no se reintenta sobre datos antiguos. */
  readonly refreshing = input(false);

  readonly cancelled = output<OwnerOrder>();
  /** El pedido mostrado puede estar desactualizado: hay que volver a consultarlo. */
  readonly stale = output();
  /** Mensajes del backend cuando la cancelación falla. */
  readonly failed = output<string[]>();

  private readonly reasonField = viewChild.required(CancellationReasonComponent);
  protected readonly confirming = signal(false);
  protected readonly submitting = signal(false);

  protected ask(): void {
    this.failed.emit([]);
    this.reasonField().clearWarning();
    this.confirming.set(true);
  }

  protected cancel(): void {
    if (this.submitting() || this.refreshing()) {
      return;
    }
    const reason = this.reasonField().read();
    if (reason === null) {
      return;
    }
    this.submitting.set(true);
    this.ordersApi
      .cancel(this.orderId(), { reason })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (order) => {
          this.confirming.set(false);
          this.cancelled.emit(order);
        },
        error: (error: unknown) => this.onError(error),
      });
  }

  private onError(error: unknown): void {
    const failure = cancellationFailure(error, CANCEL_ERROR);
    if (failure.kind === 'reason') {
      this.reasonField().reject();
      return;
    }
    this.confirming.set(false);
    this.failed.emit(failure.messages);
    if (failure.stale) {
      this.stale.emit();
    }
  }
}

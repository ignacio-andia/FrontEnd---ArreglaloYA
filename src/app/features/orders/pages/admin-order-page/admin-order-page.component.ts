import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, untracked } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { ReceiptsListComponent } from '../../../payments/components/receipts-list/receipts-list.component';
import { PaymentsApiService } from '../../../payments/services/payments-api.service';
import { ServiceHistoryComponent } from '../../../workflow/components/service-history/service-history.component';
import { ServiceWorkStore } from '../../../workflow/services/service-work.store';
import { OrderStatusBadgeComponent } from '../../components/order-status-badge/order-status-badge.component';
import { OrdersApiService } from '../../services/orders-api.service';

const ORDER_ERROR = 'No se pudo cargar el pedido.';
const RECEIPTS_ERROR = 'No se pudieron cargar las constancias.';

/**
 * Pedido visto por el administrador: registro mínimo (#68), constancias (#100) y línea de tiempo
 * (#112). Solo lectura.
 */
@Component({
  selector: 'app-admin-order-page',
  imports: [
    DatePipe,
    RouterLink,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    OrderStatusBadgeComponent,
    ReceiptsListComponent,
    ServiceHistoryComponent,
  ],
  providers: [ServiceWorkStore],
  templateUrl: './admin-order-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss'],
})
export class AdminOrderPageComponent {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly paymentsApi = inject(PaymentsApiService);
  protected readonly history = inject(ServiceWorkStore);

  protected readonly timezone = DISPLAY_TIMEZONE;

  private readonly orderId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('orderId') ?? '')),
    { requireSync: true },
  );

  protected readonly order = rxResource({
    params: () => this.orderId(),
    stream: ({ params }) => this.ordersApi.getForAdmin(params),
  });
  protected readonly notFound = computed(() => {
    const status = apiErrorStatus(this.order.error());
    return status === 404 || status === 400;
  });
  protected readonly errorMessage = computed(() => {
    const error = this.order.error();
    return error === undefined || this.notFound()
      ? null
      : apiErrorMessages(error, ORDER_ERROR).join(' ');
  });

  /** Las constancias y el historial se piden cuando el pedido existe. */
  private readonly loadedId = computed(() =>
    this.order.hasValue() ? this.order.value().id : undefined,
  );
  protected readonly receipts = rxResource({
    params: () => this.loadedId(),
    stream: ({ params }) => this.paymentsApi.getReceipts(params),
  });
  protected readonly receiptsError = computed(() => {
    const error = this.receipts.error();
    return error === undefined ? null : apiErrorMessages(error, RECEIPTS_ERROR).join(' ');
  });

  constructor() {
    effect(() => {
      const orderId = this.loadedId();
      if (orderId !== undefined) {
        untracked(() => this.history.loadHistory(orderId));
      }
    });
  }

  protected refresh(): void {
    this.order.reload();
    this.receipts.reload();
    this.history.refresh();
  }
}

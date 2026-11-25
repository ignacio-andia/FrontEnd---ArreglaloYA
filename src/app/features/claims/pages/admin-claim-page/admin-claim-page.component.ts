import { Component, computed, effect, inject, linkedSignal, untracked } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { OrderStatusBadgeComponent } from '../../../orders/components/order-status-badge/order-status-badge.component';
import { OrdersApiService } from '../../../orders/services/orders-api.service';
import { ReceiptsListComponent } from '../../../payments/components/receipts-list/receipts-list.component';
import { PaymentsApiService } from '../../../payments/services/payments-api.service';
import { ServiceHistoryComponent } from '../../../workflow/components/service-history/service-history.component';
import {
  ActionNotice,
  ActionNoticeComponent,
} from '../../../workflow/components/action-notice/action-notice.component';
import { ServiceWorkStore } from '../../../workflow/services/service-work.store';
import { ClaimDetailComponent } from '../../components/claim-detail/claim-detail.component';
import {
  ClaimChange,
  ClaimResolutionComponent,
} from '../../components/claim-resolution/claim-resolution.component';
import { ClaimsApiService } from '../../services/claims-api.service';

const CLAIM_ERROR = 'No se pudo cargar el reclamo.';
const ORDER_ERROR = 'No se pudo consultar el pedido.';
const RECEIPTS_ERROR = 'No se pudieron cargar las constancias.';

/**
 * Detalle de un reclamo para el administrador (#96) con el contexto del pedido: las partes que
 * entrega su detalle administrativo, las constancias (#100) y el historial (#112).
 */
@Component({
  selector: 'app-admin-claim-page',
  imports: [
    RouterLink,
    ActionNoticeComponent,
    ClaimDetailComponent,
    ClaimResolutionComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    OrderStatusBadgeComponent,
    ReceiptsListComponent,
    ServiceHistoryComponent,
  ],
  providers: [ServiceWorkStore],
  templateUrl: './admin-claim-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss'],
})
export class AdminClaimPageComponent {
  private readonly claimsApi = inject(ClaimsApiService);
  private readonly ordersApi = inject(OrdersApiService);
  private readonly paymentsApi = inject(PaymentsApiService);
  protected readonly history = inject(ServiceWorkStore);

  private readonly claimId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('claimId') ?? '')),
    { requireSync: true },
  );

  protected readonly claim = rxResource({
    params: () => this.claimId(),
    stream: ({ params }) => this.claimsApi.get(params),
  });
  protected readonly current = computed(() => (this.claim.hasValue() ? this.claim.value() : null));
  protected readonly notFound = computed(() => {
    const status = apiErrorStatus(this.claim.error());
    return status === 404 || status === 400;
  });
  protected readonly errorMessage = computed(() => {
    const error = this.claim.error();
    return error === undefined || this.notFound()
      ? null
      : apiErrorMessages(error, CLAIM_ERROR).join(' ');
  });

  private readonly orderId = computed(() => this.current()?.orderId);

  protected readonly order = rxResource({
    params: () => this.orderId(),
    stream: ({ params }) => this.ordersApi.getForAdmin(params),
  });
  protected readonly orderError = computed(() => {
    const error = this.order.error();
    return error === undefined ? null : apiErrorMessages(error, ORDER_ERROR).join(' ');
  });

  protected readonly receipts = rxResource({
    params: () => this.orderId(),
    stream: ({ params }) => this.paymentsApi.getReceipts(params),
  });
  protected readonly receiptsError = computed(() => {
    const error = this.receipts.error();
    return error === undefined ? null : apiErrorMessages(error, RECEIPTS_ERROR).join(' ');
  });

  /** Se borra al pasar a otro reclamo. */
  protected readonly notice = linkedSignal<string, ActionNotice | null>({
    source: this.claimId,
    computation: () => null,
  });

  constructor() {
    effect(() => {
      const orderId = this.orderId();
      if (orderId !== undefined) {
        untracked(() => this.history.loadHistory(orderId));
      }
    });
  }

  protected refresh(): void {
    this.notice.set(null);
    this.reload();
  }

  protected reload(): void {
    this.claim.reload();
    this.reloadContext();
  }

  /**
   * El reclamo que devuelve el backend se muestra tal cual, así el resultado no depende de otra
   * consulta; el pedido, las constancias y el historial se vuelven a pedir.
   */
  protected onChanged({ claim, message }: ClaimChange): void {
    this.claim.set(claim);
    this.notice.set({ failed: false, messages: [message] });
    this.reloadContext();
  }

  protected onActionFailed(messages: string[]): void {
    this.notice.set(messages.length === 0 ? null : { failed: true, messages });
  }

  private reloadContext(): void {
    this.order.reload();
    this.receipts.reload();
    this.history.refresh();
  }
}

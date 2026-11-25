import { Component, computed, effect, inject, untracked } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { WhatsappContactComponent } from '../../../offers/components/whatsapp-contact/whatsapp-contact.component';
import { OffersApiService } from '../../../offers/services/offers-api.service';
import { OrdersApiService } from '../../../orders/services/orders-api.service';
import { PaymentsSectionComponent } from '../../../payments/components/payments-section/payments-section.component';
import { ServiceHistoryComponent } from '../../components/service-history/service-history.component';
import { WorkSummaryComponent } from '../../components/work-summary/work-summary.component';
import { SERVICE_AGREEMENT_STATUSES } from '../../models/workflow.model';
import { ServiceWorkStore } from '../../services/service-work.store';

const WORKER_ERROR = 'No se pudo consultar el trabajador asignado.';

/** Seguimiento del servicio para el cliente (`/cliente/mis-pedidos/:orderId/seguimiento`). */
@Component({
  selector: 'app-tracking-page',
  imports: [
    RouterLink,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    PaymentsSectionComponent,
    ServiceHistoryComponent,
    WhatsappContactComponent,
    WorkSummaryComponent,
  ],
  providers: [ServiceWorkStore],
  templateUrl: './tracking-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss'],
})
export class TrackingPageComponent {
  private readonly offersApi = inject(OffersApiService);
  private readonly ordersApi = inject(OrdersApiService);
  protected readonly store = inject(ServiceWorkStore);

  protected readonly orderId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('orderId') ?? '')),
    { requireSync: true },
  );

  /** El pedido propio (#45) solo titula la página: si falla, el seguimiento sigue disponible. */
  private readonly order = rxResource({
    params: () => this.store.current()?.orderId,
    stream: ({ params }) => this.ordersApi.getOwn(params),
  });
  protected readonly category = computed(() =>
    this.order.hasValue() ? this.order.value().category.name : null,
  );

  /** El asignado es quien tiene la oferta `ACEPTADA` del pedido (#72). */
  protected readonly worker = rxResource({
    params: () => this.store.current()?.orderId,
    stream: ({ params }) =>
      this.offersApi.listReceived({ orderId: params, status: 'ACEPTADA', limit: 1 }),
  });
  protected readonly agreement = computed(() =>
    this.worker.hasValue() ? (this.worker.value().data[0] ?? null) : null,
  );
  protected readonly workerError = computed(() => {
    const error = this.worker.error();
    return error === undefined ? null : apiErrorMessages(error, WORKER_ERROR).join(' ');
  });
  protected readonly agreementActive = computed(() => {
    const current = this.store.current();
    return current !== null && SERVICE_AGREEMENT_STATUSES.includes(current.status);
  });

  constructor() {
    effect(() => {
      const orderId = this.orderId();
      untracked(() => this.store.load(orderId));
    });
  }

  protected refresh(): void {
    this.store.refresh();
    this.order.reload();
    this.worker.reload();
  }
}

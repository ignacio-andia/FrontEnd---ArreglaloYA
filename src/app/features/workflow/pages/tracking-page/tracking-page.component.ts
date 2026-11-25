import { Component, computed, effect, inject, linkedSignal, untracked } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { WhatsappContactComponent } from '../../../offers/components/whatsapp-contact/whatsapp-contact.component';
import { ClaimFormComponent } from '../../../claims/components/claim-form/claim-form.component';
import { OffersApiService } from '../../../offers/services/offers-api.service';
import { OrdersApiService } from '../../../orders/services/orders-api.service';
import { ClaimPanelComponent } from '../../../claims/components/claim-panel/claim-panel.component';
import { PaymentsSectionComponent } from '../../../payments/components/payments-section/payments-section.component';
import {
  ActionNotice,
  ActionNoticeComponent,
} from '../../components/action-notice/action-notice.component';
import { AdditionalBudgetListComponent } from '../../components/additional-budget-list/additional-budget-list.component';
import { ClientActionsComponent } from '../../components/client-actions/client-actions.component';
import { ConformityPanelComponent } from '../../components/conformity-panel/conformity-panel.component';
import { ServiceHistoryComponent } from '../../components/service-history/service-history.component';
import { WorkSummaryComponent } from '../../components/work-summary/work-summary.component';
import {
  BudgetResult,
  CANCELLABLE_WORK_STATUSES,
  NoShowResult,
  SERVICE_AGREEMENT_STATUSES,
} from '../../models/workflow.model';
import { ServiceWorkStore } from '../../services/service-work.store';

const WORKER_ERROR = 'No se pudo consultar el trabajador asignado.';

/** Seguimiento del servicio para el cliente (`/cliente/mis-pedidos/:orderId/seguimiento`). */
@Component({
  selector: 'app-tracking-page',
  imports: [
    RouterLink,
    ActionNoticeComponent,
    AdditionalBudgetListComponent,
    ClaimFormComponent,
    ClientActionsComponent,
    ConformityPanelComponent,
    EmptyStateComponent,
    ClaimPanelComponent,
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

  protected readonly canCancelWork = computed(() => {
    const current = this.store.current();
    return current !== null && CANCELLABLE_WORK_STATUSES.includes(current.status);
  });

  /** Se borra al pasar a otro pedido. */
  protected readonly notice = linkedSignal<string, ActionNotice | null>({
    source: this.orderId,
    computation: () => null,
  });

  constructor() {
    effect(() => {
      const orderId = this.orderId();
      untracked(() => this.store.load(orderId));
    });
  }

  /** «Actualizar»: se vuelve a consultar todo y se retira el aviso. */
  protected refresh(): void {
    this.notice.set(null);
    this.reload();
  }

  /** «Reintentar»: conserva el resultado de la última acción. */
  protected reload(): void {
    this.store.refresh();
    this.order.reload();
    this.worker.reload();
  }

  protected onBudgetResponded({ budget }: BudgetResult): void {
    const outcome =
      budget.status === 'ACEPTADO'
        ? 'aceptado. El pedido pasó a «En ejecución».'
        : 'rechazado. El pedido quedó cerrado.';
    this.succeed(`Presupuesto adicional de Bs ${budget.amount} ${outcome}`);
  }

  protected onConformityConfirmed(): void {
    this.succeed('Conformidad confirmada. El pedido quedó cerrado.');
  }

  protected onClaimSubmitted(): void {
    this.succeed(
      'Reclamo presentado. El pedido quedó «En reclamo» y un administrador lo revisará.',
    );
  }

  protected onWorkCancelled(): void {
    this.succeed('Trabajo cancelado. El pedido quedó «Cancelado».');
  }

  protected onNoShowReported({ created }: NoShowResult): void {
    this.succeed(
      created
        ? 'Inasistencia reportada. Quedó registrada; el estado del pedido no cambia.'
        : 'Ya había un reporte de inasistencia en este pedido: no se registró otro.',
    );
  }

  protected onActionFailed(messages: string[]): void {
    this.notice.set(messages.length === 0 ? null : { failed: true, messages });
  }

  /** Anuncia lo que confirmó el backend y vuelve a consultar el flujo. */
  private succeed(message: string): void {
    this.notice.set({ failed: false, messages: [message] });
    this.store.refresh();
  }
}

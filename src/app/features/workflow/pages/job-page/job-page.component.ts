import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, untracked } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { AssignedOrderComponent } from '../../../offers/components/assigned-order/assigned-order.component';
import { WhatsappContactComponent } from '../../../offers/components/whatsapp-contact/whatsapp-contact.component';
import { formatDuration } from '../../../offers/models/offer.model';
import { OffersApiService } from '../../../offers/services/offers-api.service';
import { ServiceHistoryComponent } from '../../components/service-history/service-history.component';
import { WorkSummaryComponent } from '../../components/work-summary/work-summary.component';
import { SERVICE_AGREEMENT_STATUSES } from '../../models/workflow.model';
import { ServiceWorkStore } from '../../services/service-work.store';

const AGREEMENT_ERROR = 'No se pudo consultar el acuerdo.';

/**
 * Seguimiento de un trabajo para el asignado (`/trabajador/trabajos/:orderId`). El estado y el
 * historial se conservan en cualquier estado; los datos del pedido y el contacto, solo con el
 * acuerdo vigente y según autorice el backend.
 */
@Component({
  selector: 'app-job-page',
  imports: [
    DatePipe,
    RouterLink,
    AssignedOrderComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    ServiceHistoryComponent,
    WhatsappContactComponent,
    WorkSummaryComponent,
  ],
  providers: [ServiceWorkStore],
  templateUrl: './job-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss'],
})
export class JobPageComponent {
  private readonly offersApi = inject(OffersApiService);
  protected readonly store = inject(ServiceWorkStore);

  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly duration = formatDuration;

  private readonly orderId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('orderId') ?? '')),
    { requireSync: true },
  );

  protected readonly agreementActive = computed(() => {
    const current = this.store.current();
    return current !== null && SERVICE_AGREEMENT_STATUSES.includes(current.status);
  });

  /** La oferta aceptada (#70); solo se busca con un trabajo que el backend permite ver. */
  protected readonly offer = rxResource({
    params: () => this.store.current()?.orderId,
    stream: ({ params }) => this.offersApi.findAcceptedForOrder(params),
  });
  protected readonly accepted = computed(() => (this.offer.hasValue() ? this.offer.value() : null));
  protected readonly offerError = computed(() => {
    const error = this.offer.error();
    return error === undefined ? null : apiErrorMessages(error, AGREEMENT_ERROR).join(' ');
  });

  constructor() {
    effect(() => {
      const orderId = this.orderId();
      untracked(() => this.store.load(orderId));
    });
  }

  protected refresh(): void {
    this.store.refresh();
    this.offer.reload();
  }
}

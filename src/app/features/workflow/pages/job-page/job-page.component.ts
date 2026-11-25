import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core';
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
import { PaymentsSectionComponent } from '../../../payments/components/payments-section/payments-section.component';
import { WorkerProfileApiService } from '../../../worker-profile/services/worker-profile-api.service';
import { ServiceHistoryComponent } from '../../components/service-history/service-history.component';
import { WorkSummaryComponent } from '../../components/work-summary/work-summary.component';
import { WorkerActionsComponent } from '../../components/worker-actions/worker-actions.component';
import {
  SERVICE_AGREEMENT_STATUSES,
  WorkerClearance,
  hasVisitCost,
} from '../../models/workflow.model';
import { ServiceWorkStore } from '../../services/service-work.store';

const AGREEMENT_ERROR = 'No se pudo consultar el acuerdo.';
const ELIGIBILITY_ERROR = 'No se pudo comprobar su perfil de trabajador.';

/** Resultado de una acción sobre el trabajo, visible aunque la acción ya no se ofrezca. */
interface Notice {
  failed: boolean;
  messages: string[];
}

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
    PaymentsSectionComponent,
    ServiceHistoryComponent,
    WhatsappContactComponent,
    WorkSummaryComponent,
    WorkerActionsComponent,
  ],
  providers: [ServiceWorkStore],
  templateUrl: './job-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss'],
})
export class JobPageComponent {
  private readonly offersApi = inject(OffersApiService);
  private readonly workerApi = inject(WorkerProfileApiService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
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

  /** Hay una visita sin registrar en un estado anterior a ella. */
  protected readonly visitPending = computed(() => {
    const current = this.store.current();
    return (
      current !== null &&
      current.visit === null &&
      (current.status === 'ACORDADO' || current.status === 'ANTICIPO_REGISTRADO') &&
      // Sin saber si requiere visita se muestra el aviso; si no la requiere, nada.
      this.accepted()?.requiresVisit !== false
    );
  });

  /** La elegibilidad solo se consulta si hay una acción de visita o de cobro que ofrecer. */
  private readonly needsClearance = computed(() => {
    const current = this.store.current();
    if (current === null) {
      return false;
    }
    if (current.visit !== null) {
      return hasVisitCost(current.visit.visitCost);
    }
    return current.status === 'ANTICIPO_REGISTRADO' && this.accepted()?.requiresVisit === true;
  });
  private readonly eligibility = rxResource({
    params: () => (this.needsClearance() ? true : undefined),
    stream: () => this.workerApi.getEligibility(),
  });
  protected readonly clearance = computed((): WorkerClearance => {
    const error = this.eligibility.error();
    if (error !== undefined) {
      return {
        state: 'unavailable',
        message: apiErrorMessages(error, ELIGIBILITY_ERROR).join(' '),
      };
    }
    if (!this.eligibility.hasValue()) {
      return { state: 'checking' };
    }
    const { eligible, message } = this.eligibility.value();
    return eligible ? { state: 'approved' } : { state: 'denied', message };
  });

  /** Se borra al pasar a otro trabajo. */
  protected readonly notice = linkedSignal<string, Notice | null>({
    source: this.orderId,
    computation: () => null,
  });

  constructor() {
    effect(() => {
      const orderId = this.orderId();
      untracked(() => this.store.load(orderId));
    });
  }

  /** «Actualizar» y «Reintentar»: se vuelve a consultar todo y se retira el aviso. */
  protected refresh(): void {
    this.notice.set(null);
    this.reload();
  }

  protected reload(): void {
    this.store.refresh();
    this.offer.reload();
    this.eligibility.reload();
  }

  protected reloadEligibility(): void {
    this.eligibility.reload();
  }

  protected onVisitRegistered(): void {
    this.announce({
      failed: false,
      messages: ['Visita registrada. El pedido pasó a «Visita realizada».'],
    });
    this.store.refresh();
  }

  protected onActionFailed(messages: string[]): void {
    if (messages.length === 0) {
      this.notice.set(null);
    } else {
      this.announce({ failed: true, messages });
    }
  }

  private announce(notice: Notice): void {
    this.notice.set(notice);
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('#job-notice')?.focus(),
      { injector: this.injector },
    );
  }
}

import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  untracked,
  viewChild,
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
import { ClaimPanelComponent } from '../../../claims/components/claim-panel/claim-panel.component';
import { CancellationSummaryComponent } from '../../../payments/components/cancellation-summary/cancellation-summary.component';
import { PaymentsSectionComponent } from '../../../payments/components/payments-section/payments-section.component';
import { WorkerProfileApiService } from '../../../worker-profile/services/worker-profile-api.service';
import {
  ActionNotice,
  ActionNoticeComponent,
} from '../../components/action-notice/action-notice.component';
import { AdditionalBudgetFormComponent } from '../../components/additional-budget-form/additional-budget-form.component';
import { AdditionalBudgetListComponent } from '../../components/additional-budget-list/additional-budget-list.component';
import { CancellationRecordComponent } from '../../components/cancellation-record/cancellation-record.component';
import { ServiceHistoryComponent } from '../../components/service-history/service-history.component';
import { WorkSummaryComponent } from '../../components/work-summary/work-summary.component';
import { WorkerActionsComponent } from '../../components/worker-actions/worker-actions.component';
import {
  BUDGET_ORIGIN_STATUSES,
  BudgetResult,
  SERVICE_AGREEMENT_STATUSES,
  WorkerClearance,
  hasVisitCost,
} from '../../models/workflow.model';
import { ServiceWorkStore } from '../../services/service-work.store';

const AGREEMENT_ERROR = 'No se pudo consultar el acuerdo.';
const ELIGIBILITY_ERROR = 'No se pudo comprobar su perfil de trabajador.';

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
    ActionNoticeComponent,
    AdditionalBudgetFormComponent,
    AdditionalBudgetListComponent,
    AssignedOrderComponent,
    CancellationRecordComponent,
    CancellationSummaryComponent,
    EmptyStateComponent,
    ClaimPanelComponent,
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
  protected readonly store = inject(ServiceWorkStore);

  private readonly cancellationSummary = viewChild(CancellationSummaryComponent);
  private readonly paymentsSection = viewChild(PaymentsSectionComponent);
  /** El resumen y «Pagos» se reparten los datos solo mientras ambos puedan mostrarlos. */
  protected readonly summaryShown = computed(() => this.cancellationSummary()?.failed() === false);
  protected readonly paymentsShown = computed(() => this.paymentsSection()?.failed() === false);

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

  /** Hay una acción del trabajador (visita, inicio o finalización) que mostrar. */
  protected readonly hasWorkerStep = computed(() => {
    const status = this.store.current()?.status;
    if (status === 'ACORDADO') {
      // Antes del anticipo solo se avisa de la visita; si el acuerdo no la requiere, nada.
      return this.accepted()?.requiresVisit !== false;
    }
    return (
      status === 'ANTICIPO_REGISTRADO' || status === 'VISITA_REALIZADA' || status === 'EN_EJECUCION'
    );
  });

  protected readonly canPropose = computed(() => {
    const current = this.store.current();
    return current !== null && BUDGET_ORIGIN_STATUSES.includes(current.status);
  });

  /** La elegibilidad solo se consulta si hay una acción del trabajador que ofrecer. */
  private readonly needsClearance = computed(() => {
    const current = this.store.current();
    if (current === null) {
      return false;
    }
    if (this.canPropose()) {
      return true;
    }
    if (current.visit !== null) {
      return hasVisitCost(current.visit.visitCost);
    }
    return current.status === 'ANTICIPO_REGISTRADO' && this.accepted() !== null;
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
    this.succeed('Visita registrada. El pedido pasó a «Visita realizada».');
  }

  protected onStarted(): void {
    this.succeed('Trabajo iniciado. El pedido pasó a «En ejecución».');
  }

  protected onFinished(): void {
    this.succeed('Trabajo marcado como terminado. El pedido pasó a «Terminado».');
  }

  protected onBudgetProposed({ budget }: BudgetResult): void {
    this.succeed(
      `Presupuesto adicional de Bs ${budget.amount} enviado. El pedido quedó pendiente de la respuesta del cliente.`,
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

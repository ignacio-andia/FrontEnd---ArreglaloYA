import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { OfferParty } from '../../../offers/models/offer.model';
import { Workflow, WorkerClearance, hasVisitCost } from '../../../workflow/models/workflow.model';
import {
  COMPARISON_LABELS,
  CONCEPT_LABELS,
  DeclarationResult,
  METHOD_LABELS,
  PARTY_LABELS,
  Payment,
  PaymentsOverview,
  declarationAvailability,
} from '../../models/payment.model';
import { PaymentsApiService } from '../../services/payments-api.service';
import { ConfirmVisitPaymentComponent } from '../confirm-visit-payment/confirm-visit-payment.component';
import { DeclarePaymentFormComponent } from '../declare-payment-form/declare-payment-form.component';
import { ReceiptsListComponent } from '../receipts-list/receipts-list.component';

const OVERVIEW_ERROR = 'No se pudieron cargar los pagos.';
const RECEIPTS_ERROR = 'No se pudieron cargar las constancias.';

/**
 * Pagos (#99), declaraciones (#101), cobro de la visita (#84) y constancias (#100) dentro del
 * seguimiento de un pedido.
 * Se vuelve a consultar cada vez que la página actualiza el flujo; los montos, la comparación y
 * el saldo son los del backend.
 */
@Component({
  selector: 'app-payments-section',
  imports: [
    DatePipe,
    ConfirmVisitPaymentComponent,
    DeclarePaymentFormComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    ReceiptsListComponent,
  ],
  templateUrl: './payments-section.component.html',
  styleUrls: ['../../../offers/offer-pages.scss', './payments-section.component.scss'],
})
export class PaymentsSectionComponent {
  private readonly paymentsApi = inject(PaymentsApiService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly workflow = input.required<Workflow>();
  readonly viewer = input.required<OfferParty>();

  /** Del trabajador que mira: sin perfil aprobado no se ofrece confirmar el cobro. */
  readonly clearance = input<WorkerClearance>({ state: 'checking' });

  /** Una declaración cambió el pedido o lo mostrado quedó desactualizado. */
  readonly changed = output();
  readonly retryClearance = output();

  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly concepts = CONCEPT_LABELS;
  protected readonly methods = METHOD_LABELS;
  protected readonly parties = PARTY_LABELS;
  protected readonly comparisons = COMPARISON_LABELS;

  private readonly orderId = computed(() => this.workflow().orderId);

  protected readonly overview = rxResource({
    params: () => this.orderId(),
    stream: ({ params }) => this.paymentsApi.getOverview(params),
  });
  protected readonly receipts = rxResource({
    params: () => this.orderId(),
    stream: ({ params }) => this.paymentsApi.getReceipts(params),
  });

  protected readonly current = computed(() =>
    this.overview.hasValue() ? this.overview.value() : null,
  );
  protected readonly overviewError = computed(() => {
    const error = this.overview.error();
    return error === undefined ? null : apiErrorMessages(error, OVERVIEW_ERROR).join(' ');
  });
  protected readonly receiptsError = computed(() => {
    const error = this.receipts.error();
    return error === undefined ? null : apiErrorMessages(error, RECEIPTS_ERROR).join(' ');
  });

  protected readonly cards = computed(() => {
    const overview = this.current();
    if (overview === null) {
      return [];
    }
    return overview.payments.map((payment) => ({
      payment,
      availability: declarationAvailability(payment, {
        viewer: this.viewer(),
        status: overview.orderStatus,
        visitRegistered: this.workflow().visit !== null,
        balance: overview.balance.status,
      }),
      suggested: suggestedAmount(payment, overview),
      confirmed: payment.declarations.some((item) => item.declaredBy === 'TRABAJADOR'),
      visitToCollect: this.visitToCollect(payment),
    }));
  });

  protected readonly success = signal<string | null>(null);
  protected readonly errors = signal<string[]>([]);

  constructor() {
    // Cada flujo nuevo (tras «Actualizar» o una declaración) vuelve a consultar sin vaciar la vista.
    let seen: Workflow | null = null;
    effect(() => {
      const workflow = this.workflow();
      if (seen !== null && seen !== workflow) {
        untracked(() => {
          this.overview.reload();
          this.receipts.reload();
        });
      }
      seen = workflow;
    });
  }

  protected onDeclared(result: DeclarationResult): void {
    this.errors.set([]);
    this.success.set(
      result.orderTransition === 'ANTICIPO_REGISTRADO'
        ? 'Declaración registrada. El pedido pasó a «Anticipo registrado».'
        : 'Declaración registrada.',
    );
    this.changed.emit();
    this.focusAfterRender('#payments-success');
  }

  protected onVisitCollected(): void {
    this.errors.set([]);
    this.success.set('Cobro de la visita confirmado.');
    this.changed.emit();
    this.focusAfterRender('#payments-success');
  }

  protected onFailed(messages: string[]): void {
    this.errors.set(messages);
    if (messages.length > 0) {
      this.success.set(null);
      this.focusAfterRender('#payments-error');
    }
  }

  /** Monto de la visita que el trabajador todavía puede confirmar como cobrado, o `null`. */
  private visitToCollect(payment: Payment): string | null {
    const cost = this.workflow().visit?.visitCost ?? null;
    const pending =
      payment.concept === 'VISITA' &&
      this.viewer() === 'TRABAJADOR' &&
      !payment.declarations.some((item) => item.declaredBy === 'TRABAJADOR');
    return pending && hasVisitCost(cost) ? cost : null;
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}

/** Importe que corresponde declarar: el esperado del concepto o el saldo esperado. */
function suggestedAmount(payment: Payment, overview: PaymentsOverview): string | null {
  return payment.concept === 'SALDO' ? overview.balance.amount : payment.expectedAmount;
}

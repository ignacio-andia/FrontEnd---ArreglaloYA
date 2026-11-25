import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { OfferParty } from '../../../offers/models/offer.model';
import { Workflow } from '../../../workflow/models/workflow.model';
import { CLAIM_STATUS_LABELS, Claim, ClaimParty, isFullClaim } from '../../models/claim.model';
import { ClaimsApiService } from '../../services/claims-api.service';
import { ClaimDetailComponent } from '../claim-detail/claim-detail.component';

const CLAIM_ERROR = 'No se pudo consultar el reclamo.';

/**
 * Solo puede haber reclamo en un pedido en reclamo, o cerrado tras terminar el trabajo sin que el
 * cliente diera su conformidad (así no se consulta en los demás).
 */
function mayHaveClaim({ status, execution }: Workflow): boolean {
  return (
    status === 'EN_RECLAMO' ||
    (status === 'CERRADO' && !!execution?.finishedAt && !execution.conformedAt)
  );
}

/**
 * Reclamo del pedido (#93) dentro de su seguimiento. El cliente lo ve completo; el trabajador
 * asignado, solo el estado y, una vez resuelto, la decisión: nunca la descripción ni las fotos.
 */
@Component({
  selector: 'app-claim-panel',
  imports: [DatePipe, ClaimDetailComponent, ErrorAlertComponent, LoadingStateComponent],
  templateUrl: './claim-panel.component.html',
  styleUrls: ['../../../offers/offer-pages.scss'],
  // Sin reclamo no ocupa sitio en la cuadrícula de la página.
  host: { '[style.display]': "visible() ? null : 'none'" },
})
export class ClaimPanelComponent {
  private readonly claimsApi = inject(ClaimsApiService);

  readonly workflow = input.required<Workflow>();
  readonly viewer = input.required<OfferParty>();

  protected readonly labels = CLAIM_STATUS_LABELS;
  protected readonly timezone = DISPLAY_TIMEZONE;

  protected readonly claim = rxResource({
    params: () => (mayHaveClaim(this.workflow()) ? this.workflow().orderId : undefined),
    stream: ({ params }) => this.claimsApi.getForOrder(params),
  });

  private readonly value = computed(() => (this.claim.hasValue() ? this.claim.value() : null));
  protected readonly full = computed((): Claim | null => {
    const value = this.value();
    return this.viewer() === 'CLIENTE' && value !== null && isFullClaim(value) ? value : null;
  });
  /** Para el trabajador se toman únicamente los campos que puede ver. */
  protected readonly party = computed(
    (): Pick<ClaimParty, 'status' | 'decision' | 'decidedAt'> | null => {
      const value = this.value();
      if (this.viewer() !== 'TRABAJADOR' || value === null) {
        return null;
      }
      const { status, decision, decidedAt } = value;
      return { status, decision, decidedAt };
    },
  );
  protected readonly errorMessage = computed(() => {
    const error = this.claim.error();
    if (error === undefined) {
      return null;
    }
    // Un pedido cerrado sin reclamo responde 404: no hay nada que mostrar.
    return apiErrorStatus(error) === 404 && this.workflow().status === 'CERRADO'
      ? null
      : apiErrorMessages(error, CLAIM_ERROR).join(' ');
  });
  protected readonly loading = computed(() => this.claim.isLoading() && this.value() === null);
  protected readonly visible = computed(
    () => this.loading() || this.errorMessage() !== null || this.value() !== null,
  );

  constructor() {
    // Cada flujo nuevo (tras «Actualizar» o una acción) vuelve a consultar el reclamo.
    let seen: Workflow | null = null;
    effect(() => {
      const workflow = this.workflow();
      if (seen !== null && seen !== workflow) {
        untracked(() => this.claim.reload());
      }
      seen = workflow;
    });
  }
}

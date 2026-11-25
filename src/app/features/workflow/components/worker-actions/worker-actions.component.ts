import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { Offer } from '../../../offers/models/offer.model';
import {
  STALE_ACTION_STATUSES,
  WorkerClearance,
  Workflow,
  hasVisitCost,
} from '../../models/workflow.model';
import { WorkflowApiService } from '../../services/workflow-api.service';
import { actionErrorMessages } from '../../utils/action-error';

const VISIT_ERROR = 'No se pudo registrar la visita. Inténtelo de nuevo más tarde.';

/**
 * Acciones del trabajador asignado sobre el trabajo. Por ahora, registrar la visita de
 * evaluación (#83), que depende de la oferta aceptada: si no se conoce, no se ofrece.
 */
@Component({
  selector: 'app-worker-actions',
  imports: [ConfirmDialogComponent, ErrorAlertComponent, LoadingStateComponent],
  templateUrl: './worker-actions.component.html',
  styleUrls: ['../../../offers/offer-pages.scss'],
})
export class WorkerActionsComponent {
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly workflow = input.required<Workflow>();
  /** La oferta aceptada, o `null` si no se pudo consultar o no se encontró. */
  readonly offer = input.required<Offer | null>();
  readonly offerLoading = input(false);
  readonly clearance = input.required<WorkerClearance>();

  readonly registered = output();
  /** Mensajes de un registro rechazado; vacío al volver a intentarlo. */
  readonly failed = output<string[]>();
  /** Lo mostrado puede estar desactualizado. */
  readonly stale = output();
  readonly retryOffer = output();
  readonly retryClearance = output();

  protected readonly cost = computed(() => {
    const cost = this.offer()?.visitCost ?? null;
    return hasVisitCost(cost) ? `Bs ${cost}` : 'Gratis';
  });

  protected readonly confirming = signal(false);
  protected readonly sending = signal(false);
  /** Ya se registró y falta que la página traiga el flujo actualizado. */
  protected readonly sent = linkedSignal({ source: this.workflow, computation: () => false });

  constructor() {
    effect(() => {
      if (!this.offerLoading() && this.offer() === null) {
        console.warn(
          'ArreglaloYA: no se pudo determinar si la oferta aceptada requiere visita; no se ofrece registrarla.',
        );
      }
    });
  }

  protected ask(): void {
    this.failed.emit([]);
    this.confirming.set(true);
  }

  protected register(): void {
    if (this.sending() || this.sent()) {
      return;
    }
    this.sending.set(true);
    this.workflowApi
      .registerVisit(this.workflow().orderId)
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.confirming.set(false);
          this.sent.set(true);
          this.registered.emit();
        },
        error: (error: unknown) => {
          this.confirming.set(false);
          this.failed.emit(actionErrorMessages(error, VISIT_ERROR));
          if (STALE_ACTION_STATUSES.includes(apiErrorStatus(error) ?? 0)) {
            this.stale.emit();
          }
        },
      });
  }
}

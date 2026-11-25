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
import { Observable, finalize } from 'rxjs';
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

export type WorkerStep = 'visit' | 'start' | 'finish';

interface StepTexts {
  title: string;
  hint: string;
  button: string;
  /** Completa «No puede …» cuando el perfil no está aprobado. */
  verb: string;
  heading: string;
  confirm: string;
  error: string;
}

const STEPS: Readonly<Record<WorkerStep, StepTexts>> = {
  visit: {
    title: 'Visita de evaluación',
    hint: 'Regístrela cuando ya haya realizado la visita.',
    button: 'Registrar visita realizada',
    verb: 'registrar la visita',
    heading: '¿Registrar la visita realizada?',
    confirm: 'Sí, registrar visita',
    error: 'No se pudo registrar la visita. Inténtelo de nuevo más tarde.',
  },
  start: {
    title: 'Iniciar el trabajo',
    hint: 'Inícielo cuando vaya a comenzar la ejecución.',
    button: 'Iniciar trabajo',
    verb: 'iniciar el trabajo',
    heading: '¿Iniciar el trabajo?',
    confirm: 'Sí, iniciar',
    error: 'No se pudo iniciar el trabajo. Inténtelo de nuevo más tarde.',
  },
  finish: {
    title: 'Finalizar el trabajo',
    hint: 'Márquelo como terminado cuando haya concluido lo acordado.',
    button: 'Marcar como terminado',
    verb: 'finalizar el trabajo',
    heading: '¿Marcar el trabajo como terminado?',
    confirm: 'Sí, está terminado',
    error: 'No se pudo finalizar el trabajo. Inténtelo de nuevo más tarde.',
  },
};

/**
 * La acción del trabajador asignado que corresponde ahora: registrar la visita (#83), iniciar
 * (#85) o terminar el trabajo (#87), con confirmación. Antes de la visita depende de la oferta
 * aceptada: si no se sabe si la requiere, no se ofrece ni registrarla ni iniciar.
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
  /** El flujo se está volviendo a consultar: lo mostrado puede estar desactualizado. */
  readonly refreshing = input(false);

  readonly registered = output();
  readonly started = output();
  readonly finished = output();
  /** Mensajes de una acción rechazada; vacío al volver a intentarlo. */
  readonly failed = output<string[]>();
  /** Lo mostrado puede estar desactualizado. */
  readonly stale = output();
  readonly retryOffer = output();
  readonly retryClearance = output();

  /** Antes de la visita, el paso depende de la oferta aceptada. */
  protected readonly needsOffer = computed(() => {
    const status = this.workflow().status;
    return status === 'ACORDADO' || status === 'ANTICIPO_REGISTRADO';
  });
  protected readonly step = computed((): WorkerStep => {
    const status = this.workflow().status;
    if (status === 'EN_EJECUCION') {
      return 'finish';
    }
    if (status === 'VISITA_REALIZADA') {
      return 'start';
    }
    return this.offer()?.requiresVisit === false ? 'start' : 'visit';
  });
  protected readonly texts = computed(() => STEPS[this.step()]);
  protected readonly cost = computed(() => {
    const cost = this.offer()?.visitCost ?? null;
    return hasVisitCost(cost) ? `Bs ${cost}` : 'Gratis';
  });

  /** Se cierra la confirmación si el paso cambia mientras está abierta. */
  protected readonly confirming = linkedSignal({ source: this.step, computation: () => false });
  protected readonly sending = signal(false);
  /** Ya se envió y falta que la página traiga el flujo actualizado. */
  protected readonly sent = linkedSignal({ source: this.workflow, computation: () => false });

  constructor() {
    effect(() => {
      if (this.needsOffer() && !this.offerLoading() && this.offer() === null) {
        console.warn(
          'ArreglaloYA: no se pudo determinar si la oferta aceptada requiere visita; no se ofrece registrarla ni iniciar el trabajo.',
        );
      }
    });
  }

  protected ask(): void {
    this.failed.emit([]);
    this.confirming.set(true);
  }

  protected send(): void {
    if (this.sending() || this.sent() || this.refreshing()) {
      return;
    }
    const step = this.step();
    this.sending.set(true);
    this.request(step)
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.confirming.set(false);
          this.sent.set(true);
          const done = { visit: this.registered, start: this.started, finish: this.finished };
          done[step].emit();
        },
        error: (error: unknown) => {
          this.confirming.set(false);
          this.failed.emit(actionErrorMessages(error, STEPS[step].error));
          if (STALE_ACTION_STATUSES.includes(apiErrorStatus(error) ?? 0)) {
            this.stale.emit();
          }
        },
      });
  }

  private request(step: WorkerStep): Observable<unknown> {
    const orderId = this.workflow().orderId;
    switch (step) {
      case 'visit':
        return this.workflowApi.registerVisit(orderId);
      case 'start':
        return this.workflowApi.startWork(orderId);
      case 'finish':
        return this.workflowApi.finishWork(orderId);
    }
  }
}

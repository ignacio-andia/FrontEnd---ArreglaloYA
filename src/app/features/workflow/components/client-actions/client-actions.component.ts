import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { trimmedMaxLength, trimmedRequired } from '../../../../shared/validators/text.validators';
import {
  CANCEL_WORK_REASON_MAX_LENGTH,
  NO_SHOW_DESCRIPTION_MAX_LENGTH,
  NO_SHOW_STATUSES,
  NoShowResult,
  STALE_ACTION_STATUSES,
  Workflow,
  hasVisitCost,
} from '../../models/workflow.model';
import { WorkflowApiService } from '../../services/workflow-api.service';
import { actionErrorMessages } from '../../utils/action-error';

const CANCEL_ERROR = 'No se pudo cancelar el trabajo. Inténtelo de nuevo más tarde.';
const REPORT_ERROR = 'No se pudo registrar el reporte. Inténtelo de nuevo más tarde.';

/**
 * Situaciones especiales que el cliente resuelve sobre un trabajo acordado: «Cancelar trabajo»
 * (#90, RF-34) y «El trabajador no llegó» (#91, RF-36). La plataforma no decide nada sobre el
 * dinero ya pagado ni penaliza por el reporte. La tolerancia de espera no está definida: no se
 * impone ninguna.
 */
@Component({
  selector: 'app-client-actions',
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './client-actions.component.html',
  styleUrl: './client-actions.component.scss',
})
export class ClientActionsComponent {
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly workflow = input.required<Workflow>();
  /** El flujo se está volviendo a consultar: lo mostrado puede estar desactualizado. */
  readonly refreshing = input(false);

  readonly cancelled = output();
  readonly reported = output<NoShowResult>();
  /** Mensajes de una acción rechazada; vacío al volver a intentarlo. */
  readonly failed = output<string[]>();
  /** Lo mostrado puede estar desactualizado. */
  readonly stale = output();

  protected readonly maxLength = CANCEL_WORK_REASON_MAX_LENGTH;
  protected readonly reason = inject(NonNullableFormBuilder).control('', [
    trimmedRequired,
    trimmedMaxLength(CANCEL_WORK_REASON_MAX_LENGTH),
  ]);
  private readonly reasonField = viewChild<ElementRef<HTMLTextAreaElement>>('reasonField');
  protected readonly descriptionMaxLength = NO_SHOW_DESCRIPTION_MAX_LENGTH;
  protected readonly description = inject(NonNullableFormBuilder).control('', [
    trimmedMaxLength(NO_SHOW_DESCRIPTION_MAX_LENGTH),
  ]);
  private readonly descriptionField =
    viewChild<ElementRef<HTMLTextAreaElement>>('descriptionField');

  /** El reporte se ofrece antes de la visita y del inicio, y solo uno por pedido. */
  protected readonly canReport = computed(
    () =>
      NO_SHOW_STATUSES.includes(this.workflow().status) && this.workflow().noShowReport === null,
  );
  protected readonly alreadyReported = computed(() => this.workflow().noShowReport !== null);

  protected readonly pendingBudget = computed(() =>
    this.workflow().additionalBudgets.some((budget) => budget.status === 'PENDIENTE'),
  );
  protected readonly visitToPay = computed(() =>
    hasVisitCost(this.workflow().visit?.visitCost ?? null),
  );

  /** Se cierra la confirmación si el pedido cambia de estado mientras está abierta. */
  protected readonly confirming = linkedSignal<unknown, 'cancel' | 'report' | null>({
    source: () => this.workflow().status,
    computation: () => null,
  });
  protected readonly sending = signal(false);
  /** Ya se envió y falta que la página traiga el flujo actualizado. */
  protected readonly sent = linkedSignal({ source: this.workflow, computation: () => false });

  protected ask(action: 'cancel' | 'report'): void {
    this.failed.emit([]);
    this.confirming.set(action);
  }

  protected cancel(): void {
    if (this.reason.invalid) {
      this.reason.markAsTouched();
      this.reasonField()?.nativeElement.focus();
      return;
    }
    const { orderId } = this.workflow();
    this.send(
      () => this.workflowApi.cancelWork(orderId, this.reason.value.trim()),
      CANCEL_ERROR,
      () => this.cancelled.emit(),
    );
  }

  protected report(): void {
    if (this.description.invalid) {
      this.description.markAsTouched();
      this.descriptionField()?.nativeElement.focus();
      return;
    }
    const { orderId } = this.workflow();
    this.send(
      () => this.workflowApi.reportNoShow(orderId, this.description.value.trim()),
      REPORT_ERROR,
      (result) => this.reported.emit(result),
    );
  }

  private send<T>(request: () => Observable<T>, fallback: string, done: (result: T) => void): void {
    if (this.sending() || this.sent() || this.refreshing()) {
      return;
    }
    this.sending.set(true);
    request()
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.confirming.set(null);
          this.sent.set(true);
          done(result);
        },
        error: (error: unknown) => {
          this.confirming.set(null);
          this.failed.emit(actionErrorMessages(error, fallback));
          if (STALE_ACTION_STATUSES.includes(apiErrorStatus(error) ?? 0)) {
            this.stale.emit();
          }
        },
      });
  }
}

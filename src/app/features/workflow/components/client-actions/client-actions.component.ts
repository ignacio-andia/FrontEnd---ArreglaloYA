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
import { finalize } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { trimmedMaxLength, trimmedRequired } from '../../../../shared/validators/text.validators';
import {
  CANCEL_WORK_REASON_MAX_LENGTH,
  STALE_ACTION_STATUSES,
  Workflow,
  hasVisitCost,
} from '../../models/workflow.model';
import { WorkflowApiService } from '../../services/workflow-api.service';
import { actionErrorMessages } from '../../utils/action-error';

const CANCEL_ERROR = 'No se pudo cancelar el trabajo. Inténtelo de nuevo más tarde.';

/**
 * Situaciones especiales que resuelve el cliente sobre un trabajo acordado: «Cancelar trabajo»
 * (#90, RF-34). La plataforma no decide nada sobre el dinero ya pagado.
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

  protected readonly pendingBudget = computed(() =>
    this.workflow().additionalBudgets.some((budget) => budget.status === 'PENDIENTE'),
  );
  protected readonly visitToPay = computed(() =>
    hasVisitCost(this.workflow().visit?.visitCost ?? null),
  );

  /** Se cierra la confirmación si el pedido cambia de estado mientras está abierta. */
  protected readonly confirming = linkedSignal({
    source: () => this.workflow().status,
    computation: () => false,
  });
  protected readonly sending = signal(false);
  /** Ya se envió y falta que la página traiga el flujo actualizado. */
  protected readonly sent = linkedSignal({ source: this.workflow, computation: () => false });

  protected ask(): void {
    this.failed.emit([]);
    this.confirming.set(true);
  }

  protected cancel(): void {
    if (this.reason.invalid) {
      this.reason.markAsTouched();
      this.reasonField()?.nativeElement.focus();
      return;
    }
    if (this.sending() || this.sent() || this.refreshing()) {
      return;
    }
    this.sending.set(true);
    this.workflowApi
      .cancelWork(this.workflow().orderId, this.reason.value.trim())
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.confirming.set(false);
          this.sent.set(true);
          this.cancelled.emit();
        },
        error: (error: unknown) => {
          this.confirming.set(false);
          this.failed.emit(actionErrorMessages(error, CANCEL_ERROR));
          if (STALE_ACTION_STATUSES.includes(apiErrorStatus(error) ?? 0)) {
            this.stale.emit();
          }
        },
      });
  }
}

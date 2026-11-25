import {
  Component,
  DestroyRef,
  ElementRef,
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
import { trimmedMaxLength } from '../../../../shared/validators/text.validators';
import {
  AdditionalBudget,
  BUDGET_REJECT_REASON_MAX_LENGTH,
  BudgetResult,
  STALE_ACTION_STATUSES,
} from '../../models/workflow.model';
import { WorkflowApiService } from '../../services/workflow-api.service';
import { actionErrorMessages } from '../../utils/action-error';

const SEND_ERROR = 'No se pudo enviar su respuesta. Inténtelo de nuevo más tarde.';

/** El cliente acepta (#88) o rechaza (#113) el presupuesto adicional pendiente. */
@Component({
  selector: 'app-budget-response',
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './budget-response.component.html',
  styleUrl: './budget-response.component.scss',
})
export class BudgetResponseComponent {
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly orderId = input.required<string>();
  readonly budget = input.required<AdditionalBudget>();

  readonly responded = output<BudgetResult>();
  /** Mensajes de una respuesta rechazada; vacío al volver a intentarlo. */
  readonly failed = output<string[]>();
  /** Lo mostrado puede estar desactualizado. */
  readonly stale = output();

  protected readonly reason = inject(NonNullableFormBuilder).control('', [
    trimmedMaxLength(BUDGET_REJECT_REASON_MAX_LENGTH),
  ]);
  private readonly reasonField = viewChild<ElementRef<HTMLTextAreaElement>>('reasonField');

  protected readonly confirming = signal<'accept' | 'reject' | null>(null);
  protected readonly sending = signal(false);
  /** Ya se respondió y falta que la página traiga el flujo actualizado. */
  protected readonly sent = linkedSignal({ source: this.budget, computation: () => false });

  protected ask(action: 'accept' | 'reject'): void {
    this.failed.emit([]);
    this.confirming.set(action);
  }

  protected accept(): void {
    this.send(this.workflowApi.acceptBudget(this.orderId(), this.budget().id));
  }

  protected reject(): void {
    if (this.reason.invalid) {
      this.reason.markAsTouched();
      this.reasonField()?.nativeElement.focus();
      return;
    }
    const reason = this.reason.value.trim();
    this.send(this.workflowApi.rejectBudget(this.orderId(), this.budget().id, reason));
  }

  private send(request: Observable<BudgetResult>): void {
    if (this.sending() || this.sent()) {
      return;
    }
    this.sending.set(true);
    request
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.confirming.set(null);
          this.sent.set(true);
          this.responded.emit(result);
        },
        error: (error: unknown) => {
          this.confirming.set(null);
          this.failed.emit(actionErrorMessages(error, SEND_ERROR));
          if (STALE_ACTION_STATUSES.includes(apiErrorStatus(error) ?? 0)) {
            this.stale.emit();
          }
        },
      });
  }
}

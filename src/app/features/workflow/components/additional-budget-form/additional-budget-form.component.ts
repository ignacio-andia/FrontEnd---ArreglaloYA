import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { trimmedMaxLength, trimmedRequired } from '../../../../shared/validators/text.validators';
import { budgetAmount, normalizeBudgetAmount } from '../../../orders/validators/order.validators';
import {
  BUDGET_TEXT_MAX_LENGTH,
  BudgetResult,
  ProposeBudgetRequest,
  STALE_ACTION_STATUSES,
  WorkerClearance,
  Workflow,
} from '../../models/workflow.model';
import { WorkflowApiService } from '../../services/workflow-api.service';
import { actionErrorMessages } from '../../utils/action-error';

const SEND_ERROR = 'No se pudo enviar el presupuesto. Inténtelo de nuevo más tarde.';

/**
 * El trabajador asignado propone un costo adicional (#86), con confirmación. No modifica el
 * monto original: el cliente debe aceptarlo.
 */
@Component({
  selector: 'app-additional-budget-form',
  imports: [
    ReactiveFormsModule,
    ConfirmDialogComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
  ],
  templateUrl: './additional-budget-form.component.html',
  styleUrls: ['./additional-budget-form.component.scss'],
})
export class AdditionalBudgetFormComponent {
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly workflow = input.required<Workflow>();
  readonly clearance = input.required<WorkerClearance>();

  readonly proposed = output<BudgetResult>();
  /** Mensajes de un envío rechazado; vacío al volver a intentarlo. */
  readonly failed = output<string[]>();
  /** Lo mostrado puede estar desactualizado. */
  readonly stale = output();
  readonly retryClearance = output();

  protected readonly maxLength = BUDGET_TEXT_MAX_LENGTH;
  private readonly textRules = [trimmedRequired, trimmedMaxLength(BUDGET_TEXT_MAX_LENGTH)];
  protected readonly form = this.fb.group({
    amount: this.fb.control('', [trimmedRequired, budgetAmount]),
    reason: this.fb.control('', this.textRules),
    materials: this.fb.control('', this.textRules),
  });

  protected readonly submitted = signal(false);
  protected readonly pending = signal<ProposeBudgetRequest | null>(null);
  protected readonly sending = signal(false);
  /** Ya se envió y falta que la página traiga el flujo actualizado. */
  protected readonly sent = linkedSignal({ source: this.workflow, computation: () => false });

  protected error(name: 'amount' | 'reason' | 'materials'): string | null {
    const control = this.form.controls[name];
    if (control.valid || !(control.touched || this.submitted())) {
      return null;
    }
    if (control.hasError('required')) {
      return {
        amount: 'Indique el monto adicional.',
        reason: 'Explique el motivo.',
        materials: 'Indique los materiales.',
      }[name];
    }
    return name === 'amount'
      ? 'Ingrese un monto mayor que 0, con hasta 8 dígitos enteros y 2 decimales.'
      : `Use como máximo ${BUDGET_TEXT_MAX_LENGTH} caracteres.`;
  }

  protected review(): void {
    this.submitted.set(true);
    this.failed.emit([]);
    if (this.form.invalid) {
      const first = Object.entries(this.form.controls).find(([, control]) => control.invalid);
      this.host.nativeElement.querySelector<HTMLElement>(`#budget-${first?.[0]}`)?.focus();
      return;
    }
    const { amount, reason, materials } = this.form.getRawValue();
    this.pending.set({
      amount: normalizeBudgetAmount(amount),
      reason: reason.trim(),
      materials: materials.trim(),
    });
  }

  protected send(): void {
    const request = this.pending();
    if (request === null || this.sending() || this.sent()) {
      return;
    }
    this.sending.set(true);
    this.workflowApi
      .proposeBudget(this.workflow().orderId, request)
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.pending.set(null);
          this.sent.set(true);
          this.proposed.emit(result);
        },
        error: (error: unknown) => {
          this.pending.set(null);
          this.failed.emit(actionErrorMessages(error, SEND_ERROR));
          if (STALE_ACTION_STATUSES.includes(apiErrorStatus(error) ?? 0)) {
            this.stale.emit();
          }
        },
      });
  }
}

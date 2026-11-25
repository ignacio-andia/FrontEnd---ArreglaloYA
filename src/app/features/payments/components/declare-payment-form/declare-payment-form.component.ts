import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { trimmedRequired } from '../../../../shared/validators/text.validators';
import { OfferParty } from '../../../offers/models/offer.model';
import { budgetAmount, normalizeBudgetAmount } from '../../../orders/validators/order.validators';
import {
  CONCEPT_LABELS,
  DeclarationResult,
  DeclarePaymentRequest,
  METHOD_LABELS,
  Payment,
  PaymentMethod,
  allowedMethods,
} from '../../models/payment.model';
import { PaymentsApiService } from '../../services/payments-api.service';

const SEND_ERROR = 'No se pudo registrar la declaración. Inténtelo de nuevo más tarde.';
/** Respuestas que indican que lo mostrado puede estar desactualizado. */
const STALE_STATUSES: readonly number[] = [403, 404, 409];

/**
 * «Confirmo que me pagaron» (trabajador) o «Ya pagué» (cliente) para un concepto, con
 * confirmación previa. El anticipo que confirma el trabajador es el monto esperado por el
 * backend y no se edita; en los demás casos se declara lo realmente pagado.
 */
@Component({
  selector: 'app-declare-payment-form',
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './declare-payment-form.component.html',
  styleUrl: './declare-payment-form.component.scss',
})
export class DeclarePaymentFormComponent {
  private readonly paymentsApi = inject(PaymentsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly orderId = input.required<string>();
  readonly payment = input.required<Payment>();
  readonly viewer = input.required<OfferParty>();
  /** Importe que se propone: el esperado del concepto o el saldo esperado. */
  readonly suggested = input<string | null>(null);

  readonly declared = output<DeclarationResult>();
  readonly failed = output<string[]>();
  readonly stale = output();

  protected readonly methodLabels = METHOD_LABELS;
  protected readonly isWorker = computed(() => this.viewer() === 'TRABAJADOR');
  protected readonly fixedAmount = computed(
    () => this.isWorker() && this.payment().concept === 'ANTICIPO',
  );
  protected readonly methods = computed(() => allowedMethods(this.payment().concept));
  protected readonly conceptLabel = computed(() => CONCEPT_LABELS[this.payment().concept]);
  protected readonly fieldId = computed(() => `declare-${this.payment().concept.toLowerCase()}`);
  protected readonly actionLabel = computed(() =>
    this.isWorker() ? 'Confirmar que me pagaron' : 'Declarar que ya pagué',
  );

  protected readonly form = this.fb.group({
    amount: this.fb.control('', [trimmedRequired, budgetAmount]),
    method: this.fb.control<PaymentMethod | ''>('', [Validators.required]),
  });
  protected readonly submitted = signal(false);
  protected readonly pending = signal<DeclarePaymentRequest | null>(null);
  protected readonly sending = signal(false);

  constructor() {
    effect(() => {
      const suggested = this.suggested();
      const amount = this.form.controls.amount;
      if (suggested !== null && (amount.pristine || this.fixedAmount())) {
        amount.setValue(suggested);
      }
      if (this.methods().length === 1) {
        this.form.controls.method.setValue(this.methods()[0]);
      }
    });
  }

  protected amountError(): string | null {
    const control = this.form.controls.amount;
    if (control.valid || !(control.touched || this.submitted())) {
      return null;
    }
    return control.hasError('required')
      ? 'Indique el monto.'
      : 'Ingrese un monto mayor que 0, con hasta 8 dígitos enteros y 2 decimales.';
  }

  protected methodError(): boolean {
    const control = this.form.controls.method;
    return control.invalid && (control.touched || this.submitted());
  }

  protected review(): void {
    this.submitted.set(true);
    this.failed.emit([]);
    const { amount, method } = this.form.getRawValue();
    if (this.form.invalid || method === '') {
      return;
    }
    this.pending.set({ amount: normalizeBudgetAmount(amount), method });
  }

  protected confirm(): void {
    const request = this.pending();
    if (request === null || this.sending()) {
      return;
    }
    this.sending.set(true);
    this.paymentsApi
      .declare(this.orderId(), this.payment().concept, request)
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.pending.set(null);
          this.declared.emit(result);
        },
        error: (error: unknown) => {
          this.pending.set(null);
          this.failed.emit(apiErrorMessages(error, SEND_ERROR));
          if (STALE_STATUSES.includes(apiErrorStatus(error) ?? 0)) {
            this.stale.emit();
          }
        },
      });
  }
}

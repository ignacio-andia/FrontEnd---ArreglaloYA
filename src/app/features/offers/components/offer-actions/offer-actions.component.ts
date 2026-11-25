import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { trimmedRequired } from '../../../../shared/validators/text.validators';
import { budgetAmount, normalizeBudgetAmount } from '../../../orders/validators/order.validators';
import { OFFER_MAX_ROUNDS, OfferDetail, OfferParty } from '../../models/offer.model';
import { OffersApiService } from '../../services/offers-api.service';

export type OfferAction = 'accept' | 'reject' | 'withdraw' | 'counter';

const SUCCESS: Readonly<Record<OfferAction, string>> = {
  accept: 'Oferta aceptada. El trabajador quedó asignado al pedido.',
  reject: 'Oferta rechazada.',
  withdraw: 'Retiró su oferta.',
  counter: 'Contraoferta enviada. Ahora le toca responder a la otra parte.',
};

const ACTION_ERROR = 'No se pudo completar la acción. Inténtelo de nuevo más tarde.';

/** Resultado de una acción aceptada por el backend: la oferta actualizada y qué ocurrió. */
export interface OfferActionResult {
  offer: OfferDetail;
  message: string;
}

/**
 * Acciones sobre una oferta según quién mira, el estado, el turno y la ronda. Cliente (en su
 * turno): aceptar, rechazar o contraofertar. Trabajador: contraofertar en su turno y retirar en
 * cualquiera; no puede aceptar ni rechazar. Es una ayuda de la interfaz: el backend decide y,
 * ante 403, 404 o 409, se avisa con `stale` para volver a consultar la oferta.
 */
@Component({
  selector: 'app-offer-actions',
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './offer-actions.component.html',
  styleUrl: './offer-actions.component.scss',
})
export class OfferActionsComponent {
  private readonly offersApi = inject(OffersApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly offer = input.required<OfferDetail>();
  readonly viewer = input.required<OfferParty>();

  readonly done = output<OfferActionResult>();
  readonly failed = output<string[]>();
  readonly stale = output();

  protected readonly maxRounds = OFFER_MAX_ROUNDS;

  protected readonly isOpen = computed(() => this.offer().status === 'VIGENTE');
  protected readonly myTurn = computed(() => this.offer().turn === this.viewer());
  protected readonly canAccept = computed(
    () => this.isOpen() && this.viewer() === 'CLIENTE' && this.myTurn(),
  );
  protected readonly canReject = this.canAccept;
  protected readonly canWithdraw = computed(() => this.isOpen() && this.viewer() === 'TRABAJADOR');
  protected readonly canCounter = computed(
    () => this.isOpen() && this.myTurn() && this.offer().round < OFFER_MAX_ROUNDS,
  );
  protected readonly originalAmount = computed(
    () => this.offer().history.find((event) => event.type === 'PROPUESTA')?.amount ?? null,
  );

  protected readonly amount = new FormControl('', {
    nonNullable: true,
    validators: [trimmedRequired, budgetAmount],
  });
  protected readonly amountTouched = signal(false);
  protected readonly pending = signal<OfferAction | null>(null);
  protected readonly submitting = signal(false);
  protected readonly counterAmount = signal('');

  protected amountError(): string | null {
    if (this.amount.valid || !this.amountTouched()) {
      return null;
    }
    return this.amount.hasError('required')
      ? 'Indique el nuevo monto.'
      : 'Ingrese un monto mayor que 0, con hasta 8 dígitos enteros y 2 decimales.';
  }

  protected ask(action: OfferAction): void {
    this.failed.emit([]);
    this.pending.set(action);
  }

  protected reviewCounter(): void {
    this.amountTouched.set(true);
    if (this.amount.invalid) {
      return;
    }
    this.counterAmount.set(normalizeBudgetAmount(this.amount.value));
    this.ask('counter');
  }

  protected confirm(): void {
    const action = this.pending();
    if (action === null || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.request(action)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (offer) => {
          this.pending.set(null);
          this.amount.reset('');
          this.amountTouched.set(false);
          this.done.emit({ offer, message: SUCCESS[action] });
        },
        error: (error: unknown) => {
          this.pending.set(null);
          this.failed.emit(apiErrorMessages(error, ACTION_ERROR));
          const status = apiErrorStatus(error);
          if (status === 403 || status === 404 || status === 409) {
            this.stale.emit();
          }
        },
      });
  }

  private request(action: OfferAction): Observable<OfferDetail> {
    const id = this.offer().id;
    switch (action) {
      case 'accept':
        return this.offersApi.accept(id);
      case 'reject':
        return this.offersApi.reject(id);
      case 'withdraw':
        return this.offersApi.withdraw(id);
      case 'counter':
        return this.offersApi.counter(id, this.counterAmount());
    }
  }
}

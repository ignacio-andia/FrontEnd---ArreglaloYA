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
import { Observable, finalize } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { trimmedMaxLength, trimmedRequired } from '../../../../shared/validators/text.validators';
import { STALE_ACTION_STATUSES } from '../../../workflow/models/workflow.model';
import { CLAIM_DECISION_MAX_LENGTH, Claim, DecideClaimRequest } from '../../models/claim.model';
import { ClaimsApiService } from '../../services/claims-api.service';
import { claimActionMessages } from '../../utils/claim-action-error';

const REVIEW_ERROR = 'No se pudo iniciar la revisión. Inténtelo de nuevo más tarde.';
const DECIDE_ERROR = 'No se pudo registrar la decisión. Inténtelo de nuevo más tarde.';

/** Un cambio del reclamo confirmado por el backend. */
export interface ClaimChange {
  claim: Claim;
  message: string;
}

/**
 * Acciones del administrador sobre un reclamo sin resolver: iniciar la revisión (#97) y registrar
 * la decisión y su justificación (#98), que cierra el pedido. Solo registra texto: no hay
 * sanciones ni efectos económicos.
 */
@Component({
  selector: 'app-claim-resolution',
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './claim-resolution.component.html',
  styleUrl: './claim-resolution.component.scss',
})
export class ClaimResolutionComponent {
  private readonly claimsApi = inject(ClaimsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly claim = input.required<Claim>();
  /** El reclamo se está volviendo a consultar: lo mostrado puede estar desactualizado. */
  readonly refreshing = input(false);

  readonly changed = output<ClaimChange>();
  /** Mensajes de una acción rechazada; vacío al volver a intentarlo. */
  readonly failed = output<string[]>();
  /** Lo mostrado puede estar desactualizado. */
  readonly stale = output();

  protected readonly maxLength = CLAIM_DECISION_MAX_LENGTH;
  private readonly rules = [trimmedRequired, trimmedMaxLength(CLAIM_DECISION_MAX_LENGTH)];
  protected readonly form = this.fb.group({
    decision: this.fb.control('', this.rules),
    justification: this.fb.control('', this.rules),
  });

  protected readonly reviewed = signal(false);
  /** Se cierra la confirmación si el reclamo cambia de estado mientras está abierta. */
  protected readonly confirming = linkedSignal<unknown, 'review' | 'decide' | null>({
    source: () => this.claim().status,
    computation: () => null,
  });
  protected readonly sending = signal(false);

  protected error(name: 'decision' | 'justification'): string | null {
    const control = this.form.controls[name];
    if (control.valid || !(control.touched || this.reviewed())) {
      return null;
    }
    if (control.hasError('required')) {
      return name === 'decision' ? 'Escriba la decisión.' : 'Escriba la justificación.';
    }
    return `Use como máximo ${CLAIM_DECISION_MAX_LENGTH} caracteres.`;
  }

  protected askReview(): void {
    this.failed.emit([]);
    this.confirming.set('review');
  }

  protected askDecision(): void {
    this.reviewed.set(true);
    this.failed.emit([]);
    if (this.form.invalid) {
      const first = Object.entries(this.form.controls).find(([, control]) => control.invalid);
      this.host.nativeElement.querySelector<HTMLElement>(`#claim-${first?.[0]}`)?.focus();
      return;
    }
    this.confirming.set('decide');
  }

  protected startReview(): void {
    this.send(
      () => this.claimsApi.markInReview(this.claim().id),
      REVIEW_ERROR,
      'Revisión iniciada. El reclamo quedó «En revisión».',
    );
  }

  protected decide(): void {
    const { decision, justification } = this.form.getRawValue();
    const request: DecideClaimRequest = {
      decision: decision.trim(),
      justification: justification.trim(),
    };
    this.send(
      () => this.claimsApi.decide(this.claim().id, request),
      DECIDE_ERROR,
      'Reclamo resuelto. El pedido quedó «Cerrado».',
    );
  }

  private send(request: () => Observable<Claim>, fallback: string, message: string): void {
    if (this.sending() || this.refreshing()) {
      return;
    }
    this.sending.set(true);
    request()
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (claim) => {
          this.confirming.set(null);
          this.changed.emit({ claim, message });
        },
        error: (error: unknown) => {
          this.confirming.set(null);
          this.failed.emit(claimActionMessages(error, fallback));
          if (STALE_ACTION_STATUSES.includes(apiErrorStatus(error) ?? 0)) {
            this.stale.emit();
          }
        },
      });
  }
}

import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { trimmedMaxLength, trimmedRequired } from '../../../../shared/validators/text.validators';
import { WorkerProfileStatus } from '../../../worker-profile/models/worker-profile-status.model';
import {
  DECISIONS_REQUIRING_REASON,
  DECISION_REASON_MAX_LENGTH,
  ProfileDecision,
} from '../../models/admin-worker-profile.model';
import { AdminWorkerProfilesApiService } from '../../services/admin-worker-profiles-api.service';
import { decisionCopy, decisionErrorMessages } from '../../utils/profile-decision';

const DECISION_ERROR = 'No se pudo registrar la decisión. Inténtelo de nuevo más tarde.';

/**
 * Decisiones sobre un perfil. Solo ofrece las que el backend permite (`allowedDecisions`); cada
 * una se confirma y, cuando corresponde, exige un motivo que verá el trabajador.
 */
@Component({
  selector: 'app-profile-decision',
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './profile-decision.component.html',
  styleUrl: './profile-decision.component.scss',
})
export class ProfileDecisionComponent {
  private readonly profilesApi = inject(AdminWorkerProfilesApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profileId = input.required<string>();
  readonly status = input.required<WorkerProfileStatus>();
  readonly decisions = input.required<readonly ProfileDecision[]>();
  /** El perfil se está volviendo a consultar: lo mostrado puede estar desactualizado. */
  readonly refreshing = input(false);

  /** Aviso de una decisión registrada. */
  readonly changed = output<string>();
  /** Mensajes de una decisión rechazada; vacío al volver a intentarlo. */
  readonly failed = output<string[]>();
  /** Lo mostrado puede estar desactualizado. */
  readonly stale = output();

  protected readonly maxLength = DECISION_REASON_MAX_LENGTH;
  protected readonly selected = signal<ProfileDecision | null>(null);
  protected readonly sending = signal(false);
  protected readonly attempted = signal(false);

  protected readonly options = computed(() =>
    this.decisions().map((decision) => ({
      decision,
      copy: decisionCopy(decision, this.status()),
    })),
  );
  protected readonly dialog = computed(() => {
    const decision = this.selected();
    return decision === null ? null : decisionCopy(decision, this.status());
  });
  protected readonly reasonRequired = computed(() => {
    const decision = this.selected();
    return decision !== null && DECISIONS_REQUIRING_REASON.includes(decision);
  });

  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [trimmedMaxLength(DECISION_REASON_MAX_LENGTH)],
  });

  /** Mensaje del motivo, solo después de intentar confirmar. */
  protected reasonError(): string | null {
    if (!this.attempted()) {
      return null;
    }
    if (this.reasonRequired() && trimmedRequired(this.reason) !== null) {
      return 'Escriba el motivo.';
    }
    return this.reason.invalid ? `Use como máximo ${DECISION_REASON_MAX_LENGTH} caracteres.` : null;
  }

  protected ask(decision: ProfileDecision): void {
    this.failed.emit([]);
    this.reason.reset();
    this.attempted.set(false);
    this.selected.set(decision);
  }

  protected close(): void {
    this.selected.set(null);
  }

  protected confirm(): void {
    const decision = this.selected();
    if (decision === null || this.sending() || this.refreshing()) {
      return;
    }
    this.attempted.set(true);
    if (this.reasonError() !== null) {
      return;
    }
    const reason = this.reason.value.trim();
    const done = decisionCopy(decision, this.status()).done;
    this.sending.set(true);
    this.profilesApi
      .changeStatus(this.profileId(), {
        status: decision,
        ...(reason === '' ? {} : { reason }),
      })
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.close();
          this.changed.emit(done);
        },
        error: (error: unknown) => {
          this.close();
          this.failed.emit(decisionErrorMessages(error, DECISION_ERROR));
          const status = apiErrorStatus(error);
          if (status === 404 || status === 409) {
            this.stale.emit();
          }
        },
      });
  }
}

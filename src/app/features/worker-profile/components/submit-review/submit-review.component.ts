import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { WORKER_PROFILE_STATUS_LABELS } from '../../models/worker-profile-status.model';
import { WorkerProfile } from '../../models/worker-profile.model';
import { WorkerProfileApiService } from '../../services/worker-profile-api.service';

/**
 * Envío del perfil a revisión (`POST /worker-profile/me/submit`): BORRADOR, OBSERVADO o
 * RECHAZADO pasan a PENDIENTE. Los requisitos y el estado los evalúa el backend
 * (`pendingRequirements` y `canSubmit`); no se agregan requisitos documentales propios. Si
 * `canSubmit` es falso sin requisitos pendientes, el estado actual no admite el envío (por
 * ejemplo, SUSPENDIDO). Enviar no aprueba el perfil.
 */
@Component({
  selector: 'app-submit-review',
  template: `
    <section class="section" aria-labelledby="submit-title">
      <h2 id="submit-title" class="section__title">Enviar a revisión</h2>
      <p class="section__intro">
        Cuando su perfil esté completo, envíelo para que el equipo lo revise. Mientras esté en
        revisión no podrá modificar sus datos, especialidades ni documentos.
      </p>

      @if (profile().pendingRequirements.length > 0) {
        <div class="form-notice" id="submit-pending">
          <p>Para enviarlo todavía falta:</p>
          <ul class="section__list">
            @for (requirement of profile().pendingRequirements; track requirement.field) {
              <li>{{ requirement.message }}</li>
            }
          </ul>
        </div>
      } @else if (!profile().canSubmit) {
        <p class="form-notice" id="submit-pending">
          Con el perfil en estado {{ statusLabel() }} no se puede enviar a revisión.
        </p>
      }

      @if (errors().length > 0) {
        <div class="form-alert" role="alert">
          @for (message of errors(); track $index) {
            <p>{{ message }}</p>
          }
        </div>
      }

      @if (confirming()) {
        <div class="form-notice">
          <p>¿Confirma el envío de su perfil a revisión?</p>
          <div class="section__actions">
            <button type="button" class="form-submit" [disabled]="submitting()" (click)="submit()">
              {{ submitting() ? 'Enviando…' : 'Confirmar envío' }}
            </button>
            <button
              type="button"
              class="section__secondary"
              [disabled]="submitting()"
              (click)="confirming.set(false)"
            >
              Cancelar
            </button>
          </div>
        </div>
      } @else {
        <div class="section__actions">
          <button
            type="button"
            class="form-submit"
            [disabled]="!profile().canSubmit"
            [attr.aria-describedby]="profile().canSubmit ? null : 'submit-pending'"
            (click)="confirming.set(true)"
          >
            Enviar a revisión
          </button>
        </div>
      }
    </section>
  `,
  styleUrl: '../profile-section.scss',
})
export class SubmitReviewComponent {
  private readonly workerProfileApi = inject(WorkerProfileApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = input.required<WorkerProfile>();
  readonly submitted = output<WorkerProfile>();

  protected readonly statusLabel = computed(
    () => WORKER_PROFILE_STATUS_LABELS[this.profile().status],
  );

  protected readonly confirming = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errors = signal<string[]>([]);

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.errors.set([]);
    this.workerProfileApi
      .submitForReview()
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profile) => {
          this.confirming.set(false);
          this.submitted.emit(profile);
        },
        error: (error: unknown) => {
          this.confirming.set(false);
          const messages = apiErrorMessages(error, 'No se pudo enviar el perfil a revisión.');
          // 400: requisitos faltantes (arreglo del backend). 409: el estado ya no lo permite.
          this.errors.set(
            apiErrorStatus(error) === 400
              ? ['Para enviarlo todavía falta:', ...messages]
              : messages,
          );
        },
      });
  }
}

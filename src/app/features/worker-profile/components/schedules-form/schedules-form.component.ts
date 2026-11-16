import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder } from '@angular/forms';
import { finalize } from 'rxjs';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { WorkerProfile } from '../../models/worker-profile.model';
import { WorkerProfileApiService } from '../../services/worker-profile-api.service';
import { ScheduleEditorComponent } from '../schedule-editor/schedule-editor.component';
import {
  ScheduleFormArray,
  createScheduleArray,
  createScheduleGroup,
  toScheduleRequests,
} from '../schedule-editor/schedule-form';

/**
 * Horarios de atención (`PUT /worker-profile/me/schedules`, reemplaza todos). El backend los
 * permite en cualquier estado del perfil: no forman parte de lo que se verifica.
 */
@Component({
  selector: 'app-schedules-form',
  imports: [ScheduleEditorComponent],
  template: `
    <section class="section" aria-labelledby="schedules-title">
      <h2 id="schedules-title" class="section__title">Horarios de atención</h2>
      <p class="section__intro">
        Días y horas en que atiende. Los horarios de un mismo día no pueden superponerse. Para
        enviar el perfil a revisión necesita al menos un horario activo.
      </p>

      @if (errors().length > 0) {
        <div class="form-alert" role="alert">
          @for (message of errors(); track $index) {
            <p>{{ message }}</p>
          }
        </div>
      }

      <app-schedule-editor
        [schedules]="schedules"
        [submitted]="submitted()"
        [disabled]="saving()"
        idPrefix="profile-schedule"
      />

      <div class="section__actions">
        <button type="button" class="form-submit" [disabled]="saving()" (click)="save()">
          {{ saving() ? 'Guardando…' : 'Guardar horarios' }}
        </button>
        <p class="section__status" role="status">{{ statusMessage() }}</p>
      </div>
    </section>
  `,
  styleUrl: '../profile-section.scss',
})
export class SchedulesFormComponent {
  private readonly workerProfileApi = inject(WorkerProfileApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly profile = input.required<WorkerProfile>();
  readonly saved = output<WorkerProfile>();

  protected readonly schedules: ScheduleFormArray = createScheduleArray(this.fb);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly statusMessage = signal<string | null>(null);

  constructor() {
    effect(() => {
      const profile = this.profile();
      untracked(() => {
        this.schedules.clear();
        for (const schedule of profile.schedules) {
          this.schedules.push(createScheduleGroup(this.fb, schedule));
        }
        this.schedules.markAsPristine();
        this.schedules.markAsUntouched();
      });
    });
    this.schedules.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.statusMessage.set(null));
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    this.submitted.set(true);
    this.errors.set([]);
    this.statusMessage.set(null);
    if (this.schedules.invalid) {
      this.schedules.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.workerProfileApi
      .replaceSchedules(toScheduleRequests(this.schedules))
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profile) => {
          this.submitted.set(false);
          this.saved.emit(profile);
          this.statusMessage.set('Los horarios se guardaron.');
        },
        // 400 con los horarios inválidos o superpuestos (arreglo), red o 5xx.
        error: (error: unknown) =>
          this.errors.set(apiErrorMessages(error, 'No se pudieron guardar los horarios.')),
      });
  }
}

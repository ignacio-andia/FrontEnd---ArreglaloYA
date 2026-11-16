import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { CatalogOption } from '../../../catalogs/models/catalog.model';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import {
  SERVER_FIELD_MESSAGE,
  applyServerValidationErrors,
} from '../../../../shared/utils/server-validation';
import { trimmedMaxLength } from '../../../../shared/validators/text.validators';
import { UpdateWorkerProfileRequest, WorkerProfile } from '../../models/worker-profile.model';
import { WorkerProfileApiService } from '../../services/worker-profile-api.service';
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_YEARS_OF_EXPERIENCE,
  MIN_YEARS_OF_EXPERIENCE,
  integer,
} from '../../validators/worker-profile.validators';

type DetailsField = 'yearsOfExperience' | 'description' | 'zoneId';

/**
 * Experiencia, descripción y zona (`PATCH /worker-profile/me`). Solo se muestra con el perfil
 * editable (BORRADOR u OBSERVADO). La zona solo se puede cambiar en BORRADOR; después es fija y
 * su cambio requiere una solicitud. Envía únicamente los datos modificados.
 */
@Component({
  selector: 'app-profile-details-form',
  imports: [ReactiveFormsModule],
  templateUrl: './profile-details-form.component.html',
  styleUrl: '../profile-section.scss',
})
export class ProfileDetailsFormComponent {
  private readonly workerProfileApi = inject(WorkerProfileApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly profile = input.required<WorkerProfile>();
  readonly zones = input.required<readonly CatalogOption[]>();
  readonly saved = output<WorkerProfile>();

  protected readonly limits = {
    minYears: MIN_YEARS_OF_EXPERIENCE,
    maxYears: MAX_YEARS_OF_EXPERIENCE,
    maxDescription: MAX_DESCRIPTION_LENGTH,
  };

  /** La zona se elige directamente solo antes del primer envío a revisión. */
  protected readonly canChangeZone = computed(() => this.profile().status === 'BORRADOR');

  protected readonly form = this.fb.group({
    yearsOfExperience: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(MIN_YEARS_OF_EXPERIENCE),
      Validators.max(MAX_YEARS_OF_EXPERIENCE),
      integer,
    ]),
    description: this.fb.control('', [trimmedMaxLength(MAX_DESCRIPTION_LENGTH)]),
    zoneId: this.fb.control('', [Validators.required]),
  });

  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly statusMessage = signal<string | null>(null);

  constructor() {
    // Cada versión del perfil recibida (carga o guardado) vuelve a rellenar el formulario.
    effect(() => {
      const profile = this.profile();
      untracked(() => this.resetFrom(profile));
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.statusMessage.set(null));
  }

  protected errorFor(field: DetailsField): string | null {
    const control = this.form.controls[field];
    if (control.valid || !(control.touched || this.submitted())) {
      return null;
    }
    const errors = control.errors ?? {};
    const server: unknown = errors['server'];
    if (typeof server === 'string') {
      return server;
    }
    if (errors['required']) {
      return field === 'zoneId'
        ? 'Seleccione su zona de trabajo.'
        : 'Ingrese sus años de experiencia.';
    }
    if (errors['min'] || errors['max'] || errors['integer']) {
      return `Ingrese un número entero entre ${MIN_YEARS_OF_EXPERIENCE} y ${MAX_YEARS_OF_EXPERIENCE}.`;
    }
    if (errors['maxlength']) {
      return `Use como máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`;
    }
    return SERVER_FIELD_MESSAGE;
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    this.submitted.set(true);
    this.errors.set([]);
    this.statusMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const changes = this.changes();
    if (Object.keys(changes).length === 0) {
      this.statusMessage.set('No hay cambios para guardar.');
      return;
    }

    this.saving.set(true);
    this.workerProfileApi
      .updateProfile(changes)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profile) => {
          this.submitted.set(false);
          this.saved.emit(profile);
          this.statusMessage.set('Los datos del perfil se guardaron.');
        },
        error: (error: unknown) => this.handleError(error),
      });
  }

  private changes(): UpdateWorkerProfileRequest {
    const profile = this.profile();
    const { yearsOfExperience, description, zoneId } = this.form.getRawValue();
    const changes: UpdateWorkerProfileRequest = {};
    if (yearsOfExperience !== null && yearsOfExperience !== profile.yearsOfExperience) {
      changes.yearsOfExperience = yearsOfExperience;
    }
    const trimmed = description.trim();
    const normalized = trimmed === '' ? null : trimmed;
    if (normalized !== profile.description) {
      changes.description = normalized;
    }
    if (this.canChangeZone() && zoneId !== profile.zone.id) {
      changes.zoneId = zoneId;
    }
    return changes;
  }

  private resetFrom(profile: WorkerProfile): void {
    const zoneIsOption = this.zones().some((zone) => zone.id === profile.zone.id);
    this.form.reset({
      yearsOfExperience: profile.yearsOfExperience,
      description: profile.description ?? '',
      zoneId: zoneIsOption ? profile.zone.id : '',
    });
    if (profile.status === 'BORRADOR') {
      this.form.controls.zoneId.enable({ emitEvent: false });
    } else {
      // Zona fija: no participa en la validación ni en el envío.
      this.form.controls.zoneId.disable({ emitEvent: false });
    }
  }

  private handleError(error: unknown): void {
    const messages = apiErrorMessages(error, 'No se pudieron guardar los datos del perfil.');
    if (apiErrorStatus(error) === 400) {
      const unmatched = applyServerValidationErrors(this.form, messages);
      this.errors.set(['Revise los campos marcados.', ...unmatched]);
    } else {
      // 403 (zona fija), 409 (el perfil dejó de ser editable), red o 5xx.
      this.errors.set(messages);
    }
  }
}

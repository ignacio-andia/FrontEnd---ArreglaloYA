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
import { NonNullableFormBuilder } from '@angular/forms';
import { finalize } from 'rxjs';
import { CatalogOption } from '../../../catalogs/models/catalog.model';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { WorkerProfile } from '../../models/worker-profile.model';
import { WorkerProfileApiService } from '../../services/worker-profile-api.service';
import {
  MAX_SPECIALTIES,
  MIN_SPECIALTIES,
  selectionCount,
} from '../../validators/worker-profile.validators';

/**
 * Especialidades del perfil (`PUT /worker-profile/me/specialties`, reemplaza el conjunto).
 * Solo con el perfil editable. Las especialidades desactivadas no se pueden volver a enviar.
 */
@Component({
  selector: 'app-specialties-form',
  template: `
    <section class="section" aria-labelledby="specialties-title">
      <h2 id="specialties-title" class="section__title">Especialidades</h2>

      @if (inactiveSpecialties().length > 0) {
        <p class="form-notice">
          Estas especialidades fueron desactivadas y se quitarán al guardar:
          {{ inactiveSpecialties().join(', ') }}.
        </p>
      }

      @if (errors().length > 0) {
        <div class="form-alert" role="alert">
          @for (message of errors(); track $index) {
            <p>{{ message }}</p>
          }
        </div>
      }

      <fieldset
        class="field"
        tabindex="-1"
        [attr.aria-invalid]="selectionError() ? 'true' : null"
        aria-describedby="specialties-hint"
      >
        <legend class="sr-only">Especialidades</legend>
        <p id="specialties-hint" class="field__hint">Seleccione entre {{ min }} y {{ max }}.</p>
        <ul class="field__checks">
          @for (category of categories(); track category.id) {
            <li>
              <label class="field__check">
                <input
                  type="checkbox"
                  [checked]="isSelected(category.id)"
                  [disabled]="saving()"
                  (change)="toggle(category.id, $event)"
                />
                {{ category.name }}
              </label>
            </li>
          }
        </ul>
        @if (selectionError(); as error) {
          <p class="field__error">{{ error }}</p>
        }
      </fieldset>

      <div class="section__actions">
        <button type="button" class="form-submit" [disabled]="saving()" (click)="save()">
          {{ saving() ? 'Guardando…' : 'Guardar especialidades' }}
        </button>
        <p class="section__status" role="status">{{ statusMessage() }}</p>
      </div>
    </section>
  `,
  styleUrl: '../profile-section.scss',
})
export class SpecialtiesFormComponent {
  private readonly workerProfileApi = inject(WorkerProfileApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = input.required<WorkerProfile>();
  /** Categorías activas del catálogo público. */
  readonly categories = input.required<readonly CatalogOption[]>();
  readonly saved = output<WorkerProfile>();

  protected readonly min = MIN_SPECIALTIES;
  protected readonly max = MAX_SPECIALTIES;

  protected readonly control = inject(NonNullableFormBuilder).control<string[]>(
    [],
    [selectionCount(MIN_SPECIALTIES, MAX_SPECIALTIES)],
  );
  private readonly selected = signal<readonly string[]>([]);

  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly statusMessage = signal<string | null>(null);

  protected readonly inactiveSpecialties = computed(() =>
    this.profile()
      .specialties.filter((specialty) => !specialty.isActive)
      .map((specialty) => specialty.name),
  );

  constructor() {
    effect(() => {
      const profile = this.profile();
      untracked(() => {
        const activeIds = new Set(this.categories().map((category) => category.id));
        const ids = profile.specialties
          .filter((specialty) => specialty.isActive && activeIds.has(specialty.id))
          .map((specialty) => specialty.id);
        this.setSelection(ids);
      });
    });
  }

  protected isSelected(categoryId: string): boolean {
    return this.selected().includes(categoryId);
  }

  protected selectionError(): string | null {
    if (!this.submitted() || this.control.valid) {
      return null;
    }
    return this.control.hasError('minSelection')
      ? 'Seleccione al menos una especialidad.'
      : `Seleccione como máximo ${MAX_SPECIALTIES} especialidades.`;
  }

  protected toggle(categoryId: string, event: Event): void {
    const checked = event.target instanceof HTMLInputElement && event.target.checked;
    const others = this.selected().filter((id) => id !== categoryId);
    this.setSelection(checked ? [...others, categoryId] : others);
    this.statusMessage.set(null);
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    this.submitted.set(true);
    this.errors.set([]);
    this.statusMessage.set(null);
    if (this.control.invalid) {
      return;
    }

    this.saving.set(true);
    this.workerProfileApi
      .replaceSpecialties(this.selected())
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profile) => {
          this.submitted.set(false);
          this.saved.emit(profile);
          this.statusMessage.set('Las especialidades se guardaron.');
        },
        // 400 (especialidades inactivas o inexistentes, en arreglo), 409 (no editable), red.
        error: (error: unknown) =>
          this.errors.set(apiErrorMessages(error, 'No se pudieron guardar las especialidades.')),
      });
  }

  private setSelection(ids: readonly string[]): void {
    this.selected.set(ids);
    this.control.setValue([...ids]);
  }
}

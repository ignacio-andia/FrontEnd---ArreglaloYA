import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import {
  trimmedMaxLength,
  trimmedMinLength,
  trimmedRequired,
} from '../../../../shared/validators/text.validators';
import {
  CATALOG_DESCRIPTION_MAX_LENGTH,
  CATALOG_NAME_MAX_LENGTH,
  CATALOG_NAME_MIN_LENGTH,
  CatalogItem,
  CatalogKind,
} from '../../models/catalog-admin.model';
import { CatalogsAdminApiService } from '../../services/catalogs-admin-api.service';

const SAVE_ERROR = 'No se pudo guardar. Inténtelo de nuevo más tarde.';

/** Alta de un elemento (`item` nulo) o edición de su nombre y descripción. */
@Component({
  selector: 'app-catalog-item-form',
  imports: [ReactiveFormsModule],
  templateUrl: './catalog-item-form.component.html',
  styleUrl: './catalog-item-form.component.scss',
})
export class CatalogItemFormComponent {
  private readonly catalogsApi = inject(CatalogsAdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly kind = input.required<CatalogKind>();
  readonly item = input<CatalogItem | null>(null);

  readonly saved = output<CatalogItem>();
  readonly cancelled = output();

  protected readonly descriptionMax = CATALOG_DESCRIPTION_MAX_LENGTH;
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [
      '',
      [
        trimmedRequired,
        trimmedMinLength(CATALOG_NAME_MIN_LENGTH),
        trimmedMaxLength(CATALOG_NAME_MAX_LENGTH),
      ],
    ],
    description: ['', trimmedMaxLength(CATALOG_DESCRIPTION_MAX_LENGTH)],
  });
  protected readonly attempted = signal(false);
  protected readonly sending = signal(false);
  protected readonly errors = signal<string[]>([]);

  constructor() {
    // Al cambiar de catálogo o de elemento se descarta lo escrito.
    effect(() => {
      this.kind();
      const item = this.item();
      this.form.reset({ name: item?.name ?? '', description: item?.description ?? '' });
      this.attempted.set(false);
      this.errors.set([]);
    });
  }

  protected nameError(): string | null {
    const control = this.form.controls.name;
    if (control.valid || !this.attempted()) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Escriba el nombre.';
    }
    return `El nombre debe tener entre ${CATALOG_NAME_MIN_LENGTH} y ${CATALOG_NAME_MAX_LENGTH} caracteres.`;
  }

  protected descriptionError(): string | null {
    return this.form.controls.description.valid || !this.attempted()
      ? null
      : `Use como máximo ${CATALOG_DESCRIPTION_MAX_LENGTH} caracteres.`;
  }

  protected save(): void {
    this.attempted.set(true);
    if (this.form.invalid || this.sending()) {
      return;
    }
    const name = this.form.controls.name.value.trim();
    const description = this.form.controls.description.value.trim();
    const item = this.item();
    const request =
      item === null
        ? this.catalogsApi.create(this.kind(), {
            name,
            ...(description === '' ? {} : { description }),
          })
        : this.catalogsApi.update(this.kind(), item.id, {
            name,
            description: description === '' ? null : description,
          });
    this.sending.set(true);
    this.errors.set([]);
    request
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          if (item === null) {
            this.form.reset();
            this.attempted.set(false);
          }
          this.saved.emit(saved);
        },
        error: (error: unknown) => this.errors.set(apiErrorMessages(error, SAVE_ERROR)),
      });
  }
}

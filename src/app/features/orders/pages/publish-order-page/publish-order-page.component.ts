import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CatalogsApiService } from '../../../catalogs/services/catalogs-api.service';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import {
  SERVER_FIELD_MESSAGE,
  applyServerValidationErrors,
  setServerError,
} from '../../../../shared/utils/server-validation';
import {
  trimmedMaxLength,
  trimmedMinLength,
  trimmedRequired,
} from '../../../../shared/validators/text.validators';
import { OrderPhotosPickerComponent } from '../../components/order-photos-picker/order-photos-picker.component';
import {
  OrderDraftView,
  OrderReviewComponent,
} from '../../components/order-review/order-review.component';
import { OrderWarningsComponent } from '../../components/order-warnings/order-warnings.component';
import {
  CreateOrderRequest,
  ORDER_STATUS_LABELS,
  OrderWarning,
  OrderWithWarnings,
} from '../../models/order.model';
import { OrdersApiService } from '../../services/orders-api.service';
import { PhotoPreviewService } from '../../services/photo-preview.service';
import {
  ORDER_ADDRESS_MAX_LENGTH,
  ORDER_DESCRIPTION_MAX_LENGTH,
  ORDER_DESCRIPTION_MIN_LENGTH,
  ORDER_MAX_IMAGES,
  ORDER_MIN_IMAGES,
  budgetAmount,
  normalizeBudgetAmount,
  photoCount,
} from '../../validators/order.validators';

type Step = 'form' | 'review' | 'published';
type FormField =
  | 'categoryId'
  | 'zoneId'
  | 'description'
  | 'budgetAmount'
  | 'addressLine'
  | 'addressReference'
  | 'images';

const CATALOG_ERROR = 'No se pudieron cargar las categorías o las zonas.';
const INVALID_FORM_MESSAGE = 'No se pudo publicar el pedido. Revise los campos marcados.';
const UNEXPECTED_MESSAGE = 'Ocurrió un error inesperado. Inténtelo de nuevo más tarde.';

const REQUIRED_MESSAGES: Readonly<Partial<Record<FormField, string>>> = {
  categoryId: 'Seleccione la categoría del servicio.',
  zoneId: 'Seleccione la zona.',
  description: 'Describa el problema o el servicio que necesita.',
  budgetAmount: 'Indique su presupuesto.',
  addressLine: 'Ingrese la dirección exacta.',
};

/** Errores de negocio del backend que no empiezan con el nombre del campo. */
const BUSINESS_ERROR_FIELDS: readonly [RegExp, FormField][] = [
  [/categor/i, 'categoryId'],
  [/zona/i, 'zoneId'],
  [/fotograf|imagen|megap/i, 'images'],
];

/**
 * «Publicar pedido» (área de cliente). Tres pasos:
 *
 * 1. Formulario: categoría, zona, descripción, presupuesto, dirección y de 1 a 4 fotografías.
 * 2. Revisión: se consultan los avisos orientativos (`POST /orders/duplicate-check`) y se
 *    muestra el resumen. Los avisos no bloquean: puede volver a modificar o publicar.
 * 3. Publicado: `POST /orders` en `multipart/form-data`; se muestran el pedido creado y los
 *    avisos de la respuesta.
 *
 * Las categorías y zonas salen de los catálogos públicos (solo activas). Las fotografías se
 * envían junto con el pedido, nunca antes.
 */
@Component({
  selector: 'app-publish-order-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    OrderPhotosPickerComponent,
    OrderReviewComponent,
    OrderWarningsComponent,
  ],
  providers: [PhotoPreviewService],
  templateUrl: './publish-order-page.component.html',
  styleUrl: './publish-order-page.component.scss',
})
export class PublishOrderPageComponent {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly previews = inject(PhotoPreviewService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly limits = {
    minDescription: ORDER_DESCRIPTION_MIN_LENGTH,
    maxDescription: ORDER_DESCRIPTION_MAX_LENGTH,
    maxAddress: ORDER_ADDRESS_MAX_LENGTH,
    maxImages: ORDER_MAX_IMAGES,
  };
  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly timezone = DISPLAY_TIMEZONE;

  protected readonly categories = rxResource({ stream: () => this.catalogsApi.getCategories() });
  protected readonly zones = rxResource({ stream: () => this.catalogsApi.getZones() });

  /** Solo la primera carga oculta el formulario; al recargar se conservan los datos y errores. */
  protected readonly catalogsLoading = computed(
    () =>
      !(this.zones.hasValue() && this.categories.hasValue()) &&
      (this.zones.isLoading() || this.categories.isLoading()),
  );
  protected readonly catalogsError = computed(() => {
    const error = this.zones.error() ?? this.categories.error();
    return error === undefined ? null : apiErrorMessages(error, CATALOG_ERROR).join(' ');
  });
  protected readonly categoryOptions = computed(() =>
    this.categories.hasValue() ? this.categories.value() : [],
  );
  protected readonly zoneOptions = computed(() =>
    this.zones.hasValue() ? this.zones.value() : [],
  );
  protected readonly noCategories = computed(
    () => this.categories.hasValue() && this.categories.value().length === 0,
  );
  protected readonly noZones = computed(
    () => this.zones.hasValue() && this.zones.value().length === 0,
  );
  /** Solo se puede publicar con categorías y zonas activas reales. */
  protected readonly catalogsReady = computed(
    () => this.categoryOptions().length > 0 && this.zoneOptions().length > 0,
  );

  protected readonly form = this.fb.group({
    categoryId: this.fb.control('', [Validators.required]),
    zoneId: this.fb.control('', [Validators.required]),
    description: this.fb.control('', [
      trimmedRequired,
      trimmedMinLength(ORDER_DESCRIPTION_MIN_LENGTH),
      trimmedMaxLength(ORDER_DESCRIPTION_MAX_LENGTH),
    ]),
    budgetAmount: this.fb.control('', [trimmedRequired, budgetAmount]),
    addressLine: this.fb.control('', [trimmedRequired, trimmedMaxLength(ORDER_ADDRESS_MAX_LENGTH)]),
    addressReference: this.fb.control('', [trimmedMaxLength(ORDER_ADDRESS_MAX_LENGTH)]),
    images: this.fb.control<File[]>([], [photoCount(ORDER_MIN_IMAGES, ORDER_MAX_IMAGES)]),
  });

  private readonly descriptionValue = toSignal(this.form.controls.description.valueChanges, {
    initialValue: '',
  });
  protected readonly descriptionLength = computed(() => this.descriptionValue().trim().length);

  protected readonly step = signal<Step>('form');
  protected readonly submitted = signal(false);
  protected readonly checking = signal(false);
  protected readonly publishing = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly publishErrors = signal<string[]>([]);
  protected readonly warnings = signal<OrderWarning[]>([]);
  /** La comprobación previa falló (red o servidor): no impide publicar. */
  protected readonly checkFailed = signal(false);
  protected readonly draft = signal<OrderDraftView | null>(null);
  protected readonly result = signal<OrderWithWarnings | null>(null);

  private request: CreateOrderRequest | null = null;

  /** Mensaje de error visible de un campo, o `null` si no debe mostrarse todavía. */
  protected errorFor(field: FormField): string | null {
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
      return REQUIRED_MESSAGES[field] ?? SERVER_FIELD_MESSAGE;
    }
    if (errors['minlength']) {
      return `Escriba al menos ${ORDER_DESCRIPTION_MIN_LENGTH} caracteres.`;
    }
    if (errors['maxlength']) {
      const max = field === 'description' ? ORDER_DESCRIPTION_MAX_LENGTH : ORDER_ADDRESS_MAX_LENGTH;
      return `Use como máximo ${max} caracteres.`;
    }
    if (errors['budgetAmount']) {
      return 'Ingrese un monto mayor que 0, con hasta 8 dígitos enteros y 2 decimales (por ejemplo, 150.50).';
    }
    if (errors['minPhotos']) {
      return 'Adjunte al menos una fotografía del problema.';
    }
    if (errors['maxPhotos']) {
      return `Adjunte como máximo ${ORDER_MAX_IMAGES} fotografías.`;
    }
    return SERVER_FIELD_MESSAGE;
  }

  /** `aria-describedby` del campo: su ayuda (si la tiene) y su error visible. */
  protected describedBy(field: FormField, hasHint = false): string | null {
    const ids: string[] = [];
    if (hasHint) {
      ids.push(`order-${field}-hint`);
    }
    if (this.errorFor(field) !== null) {
      ids.push(`order-${field}-error`);
    }
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected retryCatalogs(): void {
    this.categories.reload();
    this.zones.reload();
  }

  /** Paso 1 → 2: valida, consulta los avisos orientativos y muestra el resumen. */
  protected continueToReview(): void {
    if (this.checking() || !this.catalogsReady()) {
      return;
    }
    this.submitted.set(true);
    this.formErrors.set([]);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusAfterRender('[aria-invalid="true"]');
      return;
    }

    const request = this.buildRequest();
    this.checking.set(true);
    this.ordersApi
      .checkDuplicates({
        categoryId: request.categoryId,
        zoneId: request.zoneId,
        description: request.description,
      })
      .pipe(
        finalize(() => this.checking.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ warnings }) => this.showReview(request, warnings, false),
        error: (error: unknown) => {
          const status = apiErrorStatus(error);
          if (status === 400 || status === 403) {
            this.handleFormError(error);
          } else {
            // Los avisos son orientativos: si no se pudieron consultar, se puede publicar igual.
            this.showReview(request, [], true);
          }
        },
      });
  }

  /** Paso 2 → 1: vuelve al formulario con los datos intactos. */
  protected backToForm(): void {
    if (this.publishing()) {
      return;
    }
    this.publishErrors.set([]);
    this.step.set('form');
    this.focusAfterRender('#publish-form-title');
  }

  /** Paso 2 → 3: publica el pedido con sus fotografías. */
  protected publish(): void {
    const request = this.request;
    if (this.publishing() || request === null) {
      return;
    }
    this.publishing.set(true);
    this.publishErrors.set([]);
    this.ordersApi
      .createOrder(request)
      .pipe(
        finalize(() => this.publishing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => this.onPublished(result),
        error: (error: unknown) => this.handlePublishError(error),
      });
  }

  /** Paso 3 → 1: formulario vacío para otro pedido. */
  protected startOver(): void {
    this.result.set(null);
    this.step.set('form');
    this.focusAfterRender('#publish-form-title');
  }

  private showReview(
    request: CreateOrderRequest,
    warnings: OrderWarning[],
    checkFailed: boolean,
  ): void {
    this.request = request;
    this.warnings.set(warnings);
    this.checkFailed.set(checkFailed);
    this.publishErrors.set([]);
    this.draft.set({
      categoryName: this.optionName(this.categoryOptions(), request.categoryId),
      zoneName: this.optionName(this.zoneOptions(), request.zoneId),
      description: request.description,
      budgetAmount: request.budgetAmount,
      addressLine: request.addressLine,
      addressReference: request.addressReference ?? null,
      images: request.images,
    });
    this.step.set('review');
    this.focusAfterRender('#publish-review-title');
  }

  private onPublished(result: OrderWithWarnings): void {
    this.result.set(result);
    this.request = null;
    this.draft.set(null);
    this.warnings.set([]);
    this.submitted.set(false);
    this.form.reset();
    this.previews.keepOnly([]);
    this.step.set('published');
    this.focusAfterRender('#publish-done-title');
  }

  private handlePublishError(error: unknown): void {
    const status = apiErrorStatus(error);
    if (status === 400 || status === 404 || status === 413) {
      // Datos, catálogos o fotografías rechazados: se corrigen en el formulario.
      this.handleFormError(error);
      return;
    }
    // Red, permisos o servidor: se mantiene el resumen para reintentar.
    this.publishErrors.set(apiErrorMessages(error, UNEXPECTED_MESSAGE));
    this.focusAfterRender('#publish-error');
  }

  /**
   * Lleva los errores del servidor a sus campos y vuelve al formulario. Si el formulario no está
   * visible (paso de revisión), los errores se aplican después de mostrarlo: al volver a enlazar
   * los controles, Angular recalcula su validez y borraría un error del servidor puesto antes.
   */
  private handleFormError(error: unknown): void {
    const status = apiErrorStatus(error);
    const messages = apiErrorMessages(error, UNEXPECTED_MESSAGE);
    const fieldErrors = status === 400 || status === 404 || status === 413;

    if (fieldErrors && status !== 413) {
      // Una categoría o zona pudo desactivarse desde que se cargó el catálogo.
      this.retryCatalogs();
    }

    const show = (): void => {
      this.formErrors.set(
        fieldErrors
          ? [INVALID_FORM_MESSAGE, ...this.applyServerErrors(messages, status === 413)]
          : messages,
      );
      this.focusAfterRender('#order-error-summary');
    };

    if (this.step() === 'form') {
      show();
    } else {
      this.step.set('form');
      afterNextRender(show, { injector: this.injector });
    }
  }

  /**
   * Asocia cada mensaje a su campo: los de validación del DTO empiezan con el nombre del campo;
   * los de negocio (catálogo inactivo o inexistente, fotografías) se reconocen por su texto.
   * Devuelve los que no corresponden a ningún campo.
   */
  private applyServerErrors(messages: readonly string[], photoTooLarge: boolean): string[] {
    if (photoTooLarge) {
      setServerError(this.form.controls.images, messages.join(' '));
      return [];
    }
    const unmatched: string[] = [];
    for (const message of applyServerValidationErrors(this.form, messages)) {
      const field = BUSINESS_ERROR_FIELDS.find(([pattern]) => pattern.test(message))?.[1];
      if (field === undefined) {
        unmatched.push(message);
      } else {
        setServerError(this.form.controls[field], message);
      }
    }
    return unmatched;
  }

  /** Petición con las propiedades del DTO: textos recortados y referencia vacía omitida. */
  private buildRequest(): CreateOrderRequest {
    const value = this.form.getRawValue();
    const request: CreateOrderRequest = {
      categoryId: value.categoryId,
      zoneId: value.zoneId,
      description: value.description.trim(),
      budgetAmount: normalizeBudgetAmount(value.budgetAmount),
      addressLine: value.addressLine.trim(),
      images: [...value.images],
    };
    const reference = value.addressReference.trim();
    if (reference !== '') {
      request.addressReference = reference;
    }
    return request;
  }

  private optionName(options: readonly { id: string; name: string }[], id: string): string {
    return options.find((option) => option.id === id)?.name ?? '';
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}

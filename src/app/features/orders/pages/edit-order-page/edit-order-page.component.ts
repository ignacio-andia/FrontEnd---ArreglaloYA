import { DatePipe, Location } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
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
import { CatalogOption } from '../../../catalogs/models/catalog.model';
import { CatalogsApiService } from '../../../catalogs/services/catalogs-api.service';
import { OrderPhotoManagerComponent } from '../../components/order-photo-manager/order-photo-manager.component';
import { OrderWarningsComponent } from '../../components/order-warnings/order-warnings.component';
import {
  ORDER_STATUS_LABELS,
  OrderWarning,
  OwnerOrder,
  UpdateOrderRequest,
} from '../../models/order.model';
import { ordersListQueryFrom } from '../../models/orders-list-navigation.model';
import { OrdersApiService } from '../../services/orders-api.service';
import {
  ORDER_ADDRESS_MAX_LENGTH,
  ORDER_DESCRIPTION_MAX_LENGTH,
  ORDER_DESCRIPTION_MIN_LENGTH,
  budgetAmount,
  normalizeBudgetAmount,
} from '../../validators/order.validators';

type FormField = 'categoryId' | 'description' | 'budgetAmount' | 'addressLine' | 'addressReference';

const LOAD_ERROR = 'No se pudo cargar el pedido. Compruebe su conexión e inténtelo de nuevo.';
const CATALOG_ERROR = 'No se pudieron cargar las categorías.';
const INVALID_FORM_MESSAGE = 'No se pudieron guardar los cambios. Revise los campos marcados.';
const UNEXPECTED_MESSAGE = 'Ocurrió un error inesperado. Inténtelo de nuevo más tarde.';
const SAVED_MESSAGE = 'Los cambios se guardaron.';
const NO_CHANGES_MESSAGE = 'No hay cambios para guardar.';

const REQUIRED_MESSAGES: Readonly<Record<FormField, string>> = {
  categoryId: 'Seleccione la categoría del servicio.',
  description: 'Describa el problema o el servicio que necesita.',
  budgetAmount: 'Indique su presupuesto.',
  addressLine: 'Ingrese la dirección exacta.',
  addressReference: '',
};

/**
 * «Editar pedido» (`PATCH /orders/me/:orderId`) y sus fotografías. Solo se pueden modificar la
 * categoría, la descripción, el presupuesto y la dirección: la zona es fija. Se envía únicamente
 * lo que cambió. Editar no reinicia el vencimiento. Lo que se puede editar lo decide el backend
 * (`canEdit`); ante un 409 se vuelve a consultar el pedido.
 */
@Component({
  selector: 'app-edit-order-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    OrderPhotoManagerComponent,
    OrderWarningsComponent,
  ],
  templateUrl: './edit-order-page.component.html',
  styleUrls: ['../../order-form.scss', './edit-order-page.component.scss'],
})
export class EditOrderPageComponent {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly limits = {
    minDescription: ORDER_DESCRIPTION_MIN_LENGTH,
    maxDescription: ORDER_DESCRIPTION_MAX_LENGTH,
    maxAddress: ORDER_ADDRESS_MAX_LENGTH,
  };

  protected readonly orderId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('orderId') ?? '')),
    { requireSync: true },
  );

  /** Estado de navegación que permite volver al mismo filtro y página del listado. */
  protected readonly listState = {
    ordersListQuery: ordersListQueryFrom(
      inject(Router).currentNavigation()?.extras.state ?? inject(Location).getState(),
    ),
  };

  protected readonly order = rxResource({
    params: () => this.orderId() || undefined,
    stream: ({ params }) => this.ordersApi.getOwn(params),
  });

  protected readonly categories = rxResource({ stream: () => this.catalogsApi.getCategories() });

  protected readonly current = computed(() => (this.order.hasValue() ? this.order.value() : null));
  protected readonly loadStatus = computed(() => apiErrorStatus(this.order.error()));
  /** 404 (inexistente o ajeno) y 400 (identificador inválido) se muestran igual. */
  protected readonly notFound = computed(
    () => this.loadStatus() === 404 || this.loadStatus() === 400,
  );
  protected readonly loadError = computed(() => {
    const error = this.order.error();
    return error === undefined || this.notFound()
      ? null
      : apiErrorMessages(error, LOAD_ERROR).join(' ');
  });
  protected readonly categoriesError = computed(() => {
    const error = this.categories.error();
    return error === undefined ? null : apiErrorMessages(error, CATALOG_ERROR).join(' ');
  });

  /**
   * Categorías activas más la actual si fue desactivada: conservarla no se envía, por lo que no
   * obliga a cambiarla.
   */
  protected readonly categoryOptions = computed((): CatalogOption[] => {
    const options = this.categories.hasValue() ? this.categories.value() : [];
    const current = this.current()?.category;
    if (!current || options.some((option) => option.id === current.id)) {
      return options;
    }
    return [
      { id: current.id, name: `${current.name} (desactivada)`, description: null },
      ...options,
    ];
  });

  protected readonly form = this.fb.group({
    categoryId: this.fb.control('', [Validators.required]),
    description: this.fb.control('', [
      trimmedRequired,
      trimmedMinLength(ORDER_DESCRIPTION_MIN_LENGTH),
      trimmedMaxLength(ORDER_DESCRIPTION_MAX_LENGTH),
    ]),
    budgetAmount: this.fb.control('', [trimmedRequired, budgetAmount]),
    addressLine: this.fb.control('', [trimmedRequired, trimmedMaxLength(ORDER_ADDRESS_MAX_LENGTH)]),
    addressReference: this.fb.control('', [trimmedMaxLength(ORDER_ADDRESS_MAX_LENGTH)]),
  });

  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly statusMessage = signal<string | null>(null);
  protected readonly warnings = signal<OrderWarning[]>([]);

  /** Pedido cuyos datos están en el formulario: cambiar las fotografías no lo vuelve a llenar. */
  private filledOrderId: string | null = null;

  constructor() {
    effect(() => {
      const order = this.current();
      if (order !== null && order.id !== this.filledOrderId) {
        untracked(() => this.fillForm(order));
      }
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.statusMessage.set(null));
  }

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
      return REQUIRED_MESSAGES[field];
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
    return SERVER_FIELD_MESSAGE;
  }

  /** `aria-describedby` del campo: su ayuda (si la tiene) y su error visible. */
  protected describedBy(field: FormField, hasHint = false): string | null {
    const ids: string[] = [];
    if (hasHint) {
      ids.push(`edit-${field}-hint`);
    }
    if (this.errorFor(field) !== null) {
      ids.push(`edit-${field}-error`);
    }
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected save(): void {
    const order = this.current();
    if (this.saving() || order === null || !order.canEdit) {
      return;
    }
    this.submitted.set(true);
    this.errors.set([]);
    this.statusMessage.set(null);
    this.warnings.set([]);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusAfterRender('[aria-invalid="true"]');
      return;
    }

    const changes = this.changesFrom(order);
    if (Object.keys(changes).length === 0) {
      // El backend responde 400 si no se envía ningún dato.
      this.statusMessage.set(NO_CHANGES_MESSAGE);
      return;
    }

    this.saving.set(true);
    this.ordersApi
      .update(order.id, changes)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ order: updated, warnings }) => {
          this.order.set(updated);
          this.fillForm(updated);
          this.warnings.set(warnings);
          this.statusMessage.set(SAVED_MESSAGE);
          this.focusAfterRender('#edit-saved');
        },
        error: (error: unknown) => this.handleError(error),
      });
  }

  /** Las fotografías cambiaron: se muestra el pedido que devolvió el backend. */
  protected onPhotosChanged(order: OwnerOrder): void {
    this.order.set(order);
  }

  /** El pedido pudo cambiar de estado o de fotografías: se vuelve a consultar. */
  protected refresh(): void {
    this.order.reload();
  }

  private fillForm(order: OwnerOrder): void {
    this.filledOrderId = order.id;
    this.submitted.set(false);
    this.form.reset(
      {
        categoryId: order.category.id,
        description: order.description,
        budgetAmount: order.budgetAmount,
        addressLine: order.address?.addressLine ?? '',
        addressReference: order.address?.reference ?? '',
      },
      { emitEvent: false },
    );
  }

  /** Solo las propiedades modificadas, con los textos recortados como hace el backend. */
  private changesFrom(order: OwnerOrder): UpdateOrderRequest {
    const value = this.form.getRawValue();
    const changes: UpdateOrderRequest = {};

    if (value.categoryId !== order.category.id) {
      changes.categoryId = value.categoryId;
    }
    const description = value.description.trim();
    if (description !== order.description) {
      changes.description = description;
    }
    const amount = normalizeBudgetAmount(value.budgetAmount);
    // «150.5» y «150.50» son el mismo monto.
    if (Number(amount) !== Number(order.budgetAmount)) {
      changes.budgetAmount = amount;
    }
    const addressLine = value.addressLine.trim();
    if (addressLine !== (order.address?.addressLine ?? '')) {
      changes.addressLine = addressLine;
    }
    const reference = value.addressReference.trim();
    if (reference !== (order.address?.reference ?? '')) {
      changes.addressReference = reference === '' ? null : reference;
    }
    return changes;
  }

  private handleError(error: unknown): void {
    const status = apiErrorStatus(error);
    const messages = apiErrorMessages(error, UNEXPECTED_MESSAGE);
    const aboutCategory = messages.some((message) => /categor/i.test(message));

    if (status === 400 || (status === 404 && aboutCategory)) {
      const unmatched: string[] = [];
      for (const message of applyServerValidationErrors(this.form, messages)) {
        if (/categor/i.test(message)) {
          setServerError(this.form.controls.categoryId, message);
        } else {
          unmatched.push(message);
        }
      }
      this.errors.set([INVALID_FORM_MESSAGE, ...unmatched]);
      if (aboutCategory) {
        // La categoría pudo desactivarse desde que se cargó el catálogo.
        this.categories.reload();
      }
    } else {
      this.errors.set(messages);
      if (status === 404 || status === 409) {
        // El pedido ya no existe o dejó de ser editable.
        this.refresh();
      }
    }
    this.focusAfterRender('#edit-error-summary');
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}

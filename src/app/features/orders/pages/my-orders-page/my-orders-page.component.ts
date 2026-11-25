import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { OrderPhotoComponent } from '../../components/order-photo/order-photo.component';
import { OrderStatusBadgeComponent } from '../../components/order-status-badge/order-status-badge.component';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  OrderStatus,
  OwnerOrder,
  isOrderStatus,
} from '../../models/order.model';
import {
  OrdersListNavigationState,
  PAGE_PARAM,
  STATUS_PARAM,
} from '../../models/orders-list-navigation.model';
import { OrdersApiService } from '../../services/orders-api.service';

/** Pedidos por página (el backend admite hasta 50). */
export const MY_ORDERS_PAGE_SIZE = 12;

const LIST_ERROR = 'No se pudieron cargar sus pedidos. Compruebe su conexión e inténtelo de nuevo.';

/**
 * «Mis pedidos» (área de cliente): pedidos propios con filtro por estado efectivo y paginación,
 * ambos resueltos por el backend (`GET /orders/me`). El filtro y la página viven en la URL.
 */
@Component({
  selector: 'app-my-orders-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    OrderPhotoComponent,
    OrderStatusBadgeComponent,
    PaginatorComponent,
  ],
  templateUrl: './my-orders-page.component.html',
  styleUrl: './my-orders-page.component.scss',
})
export class MyOrdersPageComponent {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly statuses = ORDER_STATUSES;
  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly timezone = DISPLAY_TIMEZONE;

  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });

  /** Filtro vigente; un valor desconocido en la URL se ignora. */
  protected readonly status = computed((): OrderStatus | null => {
    const value = this.queryParams().get(STATUS_PARAM);
    return value !== null && isOrderStatus(value) ? value : null;
  });

  /** Página vigente; un valor inválido en la URL equivale a la primera. */
  protected readonly page = computed(() => {
    const value = Number(this.queryParams().get(PAGE_PARAM));
    return Number.isInteger(value) && value >= 1 ? value : 1;
  });

  protected readonly orders = rxResource({
    params: () => ({ status: this.status(), page: this.page() }),
    stream: ({ params }) =>
      this.ordersApi.listOwn({
        ...(params.status !== null ? { status: params.status } : {}),
        page: params.page,
        limit: MY_ORDERS_PAGE_SIZE,
      }),
  });

  protected readonly statusFilter = new FormControl<OrderStatus | ''>('', { nonNullable: true });

  protected readonly meta = computed(() =>
    this.orders.hasValue() ? this.orders.value().meta : null,
  );
  protected readonly items = computed(() =>
    this.orders.hasValue() ? this.orders.value().data : [],
  );
  /** Recarga con resultados anteriores visibles (cambio de filtro o de página). */
  protected readonly refreshing = computed(() => this.orders.isLoading() && this.orders.hasValue());

  protected readonly errorStatus = computed(() => apiErrorStatus(this.orders.error()));
  protected readonly errorMessage = computed(() => {
    const error = this.orders.error();
    if (error === undefined) {
      return null;
    }
    return this.errorStatus() === 403
      ? apiErrorMessages(error, 'No tiene permiso para ver pedidos.').join(' ')
      : LIST_ERROR;
  });

  /** Estado que recibe el detalle para volver a este filtro y esta página. */
  protected readonly detailState = computed((): OrdersListNavigationState => {
    const query: Params = {};
    const status = this.status();
    if (status !== null) {
      query[STATUS_PARAM] = status;
    }
    if (this.page() > 1) {
      query[PAGE_PARAM] = this.page();
    }
    return { ordersListQuery: query };
  });

  constructor() {
    // La URL manda: el selector refleja el filtro vigente (por ejemplo, al usar «Atrás»).
    effect(() => this.statusFilter.setValue(this.status() ?? '', { emitEvent: false }));

    this.statusFilter.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((status) => this.navigate({ [STATUS_PARAM]: status || null, [PAGE_PARAM]: null }));
  }

  /** Imagen de portada: la primera según `position` (el backend ya las ordena). */
  protected cover(order: OwnerOrder): string | null {
    return order.images[0]?.id ?? null;
  }

  protected goToPage(page: number): void {
    // La primera página siempre es válida (también cuando la URL apunta a una que no existe).
    const totalPages = this.meta()?.totalPages ?? 1;
    if (page < 1 || (page > 1 && page > totalPages)) {
      return;
    }
    this.navigate({ [PAGE_PARAM]: page > 1 ? page : null });
    this.focusAfterRender('#my-orders-results');
  }

  protected showAll(): void {
    this.navigate({ [STATUS_PARAM]: null, [PAGE_PARAM]: null });
  }

  protected retry(): void {
    this.orders.reload();
  }

  private navigate(queryParams: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}

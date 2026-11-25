import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { OrderStatusBadgeComponent } from '../../components/order-status-badge/order-status-badge.component';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  OrderStatus,
  isOrderStatus,
} from '../../models/order.model';
import { OrdersApiService } from '../../services/orders-api.service';

export const ADMIN_ORDERS_PAGE_SIZE = 20;
const LIST_ERROR = 'No se pudieron cargar los pedidos.';

/** Todos los pedidos para el administrador (#67), filtrables por estado (`?estado=&pagina=`). */
@Component({
  selector: 'app-admin-orders-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    OrderStatusBadgeComponent,
    PaginatorComponent,
  ],
  templateUrl: './admin-orders-page.component.html',
  styleUrls: ['../../../offers/offer-pages.scss', './admin-orders-page.component.scss'],
})
export class AdminOrdersPageComponent {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly statuses = ORDER_STATUSES;
  protected readonly labels = ORDER_STATUS_LABELS;
  protected readonly timezone = DISPLAY_TIMEZONE;

  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly status = computed((): OrderStatus | null => {
    const value = this.query().get('estado');
    return value !== null && isOrderStatus(value) ? value : null;
  });
  protected readonly page = computed(() => {
    const value = Number(this.query().get('pagina'));
    return Number.isInteger(value) && value >= 1 ? value : 1;
  });

  protected readonly orders = rxResource({
    params: () => ({ status: this.status(), page: this.page() }),
    stream: ({ params }) =>
      this.ordersApi.listForAdmin({
        status: params.status ?? undefined,
        page: params.page,
        limit: ADMIN_ORDERS_PAGE_SIZE,
      }),
  });
  protected readonly meta = computed(() =>
    this.orders.hasValue() ? this.orders.value().meta : null,
  );
  protected readonly items = computed(() =>
    this.orders.hasValue() ? this.orders.value().data : [],
  );
  protected readonly errorMessage = computed(() => {
    const error = this.orders.error();
    return error === undefined ? null : apiErrorMessages(error, LIST_ERROR).join(' ');
  });

  protected readonly statusFilter = new FormControl<OrderStatus | ''>('', { nonNullable: true });

  constructor() {
    effect(() => this.statusFilter.setValue(this.status() ?? '', { emitEvent: false }));
    this.statusFilter.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((status) => this.navigate({ estado: status || null, pagina: null }));
  }

  protected goToPage(page: number): void {
    this.navigate({ pagina: page > 1 ? page : null });
  }

  private navigate(queryParams: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}

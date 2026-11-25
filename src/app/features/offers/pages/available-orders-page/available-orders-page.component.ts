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
import { CatalogsApiService } from '../../../catalogs/services/catalogs-api.service';
import { OrderPhotoComponent } from '../../../orders/components/order-photo/order-photo.component';
import { OrdersApiService } from '../../../orders/services/orders-api.service';
import { WorkerProfileApiService } from '../../../worker-profile/services/worker-profile-api.service';

export const AVAILABLE_PAGE_SIZE = 12;
const LIST_ERROR = 'No se pudieron cargar los pedidos disponibles.';

/**
 * Pedidos que el trabajador aprobado puede ver y ofertar (`GET /orders/available`). La
 * visibilidad (zona, especialidades, vigencia) la decide el backend; nunca incluyen la dirección
 * ni datos del cliente.
 */
@Component({
  selector: 'app-available-orders-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    OrderPhotoComponent,
    PaginatorComponent,
  ],
  templateUrl: './available-orders-page.component.html',
  styleUrls: ['../../offer-pages.scss', './available-orders-page.component.scss'],
})
export class AvailableOrdersPageComponent {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly workerProfileApi = inject(WorkerProfileApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly timezone = DISPLAY_TIMEZONE;
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });

  protected readonly categoryId = computed(() => this.query().get('categoria'));
  protected readonly page = computed(() => {
    const value = Number(this.query().get('pagina'));
    return Number.isInteger(value) && value >= 1 ? value : 1;
  });

  protected readonly orders = rxResource({
    params: () => ({ categoryId: this.categoryId(), page: this.page() }),
    stream: ({ params }) =>
      this.ordersApi.listAvailable({
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
        page: params.page,
        limit: AVAILABLE_PAGE_SIZE,
      }),
  });
  protected readonly categories = rxResource({ stream: () => this.catalogsApi.getCategories() });
  /** Explica una lista vacía cuando hay un cambio de zona pendiente (RF-13). */
  protected readonly eligibility = rxResource({
    stream: () => this.workerProfileApi.getEligibility(),
  });

  protected readonly meta = computed(() =>
    this.orders.hasValue() ? this.orders.value().meta : null,
  );
  protected readonly items = computed(() =>
    this.orders.hasValue() ? this.orders.value().data : [],
  );
  protected readonly blocked = computed(
    () => this.eligibility.hasValue() && !this.eligibility.value().canTakeNewWork,
  );
  protected readonly errorMessage = computed(() => {
    const error = this.orders.error();
    return error === undefined ? null : apiErrorMessages(error, LIST_ERROR).join(' ');
  });

  protected readonly categoryFilter = new FormControl('', { nonNullable: true });

  constructor() {
    effect(() => {
      const value = this.categoryId() ?? '';
      // Se vuelve a aplicar cuando llegan las opciones del selector.
      this.categories.value();
      this.categoryFilter.setValue(value, { emitEvent: false });
    });
    this.categoryFilter.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((categoria) => this.navigate({ categoria: categoria || null, pagina: null }));
  }

  protected goToPage(page: number): void {
    this.navigate({ pagina: page > 1 ? page : null });
  }

  protected showAll(): void {
    this.navigate({ categoria: null, pagina: null });
  }

  private navigate(queryParams: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}

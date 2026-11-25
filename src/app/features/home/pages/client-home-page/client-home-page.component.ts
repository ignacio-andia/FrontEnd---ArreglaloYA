import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../../../core/auth/session.store';
import { ActionCardComponent } from '../../../../shared/components/action-card/action-card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { OrderStatusBadgeComponent } from '../../../orders/components/order-status-badge/order-status-badge.component';
import { OrdersApiService } from '../../../orders/services/orders-api.service';

/** Pedidos recientes que muestra el inicio del cliente. */
export const RECENT_ORDERS_LIMIT = 3;

const ORDERS_ERROR = 'No se pudieron cargar sus pedidos recientes.';

/** Inicio del área de cliente: accesos y pedidos propios más recientes (`GET /orders/me`). */
@Component({
  selector: 'app-client-home-page',
  imports: [
    DatePipe,
    RouterLink,
    ActionCardComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    OrderStatusBadgeComponent,
  ],
  templateUrl: './client-home-page.component.html',
  styleUrls: ['../../home-page.scss', './client-home-page.component.scss'],
})
export class ClientHomePageComponent {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly session = inject(SessionStore);

  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly firstName = computed(() => this.session.user()?.firstName ?? '');
  protected readonly isWorker = computed(
    () => this.session.user()?.roles.includes('TRABAJADOR') ?? false,
  );

  protected readonly orders = rxResource({
    stream: () => this.ordersApi.listOwn({ page: 1, limit: RECENT_ORDERS_LIMIT }),
  });

  protected readonly ordersError = computed(() => {
    const error = this.orders.error();
    return error === undefined ? null : apiErrorMessages(error, ORDERS_ERROR).join(' ');
  });
}

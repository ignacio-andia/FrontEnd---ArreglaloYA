import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { OrderGalleryComponent } from '../../../orders/components/order-gallery/order-gallery.component';
import { OrdersApiService } from '../../../orders/services/orders-api.service';
import { OffersApiService } from '../../services/offers-api.service';

const LOAD_ERROR = 'No se pudo cargar el pedido.';

/**
 * Detalle de un pedido disponible (`GET /orders/available/:orderId`) con el acceso para ofertar.
 * Si el trabajador ya tiene una oferta en él, se enlaza en lugar de ofrecer otra; mientras eso no
 * se pueda comprobar no se ofrece enviar (solo reintentar). Es una ayuda: quién puede ofertar, incluidos los duplicados, lo decide el backend al enviar.
 */
@Component({
  selector: 'app-available-order-page',
  imports: [
    DatePipe,
    RouterLink,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    OrderGalleryComponent,
  ],
  templateUrl: './available-order-page.component.html',
  styleUrls: ['../../offer-pages.scss'],
})
export class AvailableOrderPageComponent {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly offersApi = inject(OffersApiService);

  protected readonly timezone = DISPLAY_TIMEZONE;

  private readonly orderId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('orderId') ?? '')),
    { requireSync: true },
  );

  protected readonly order = rxResource({
    params: () => this.orderId() || undefined,
    stream: ({ params }) => this.ordersApi.getAvailable(params),
  });

  /** La oferta propia más reciente en este pedido (se espera al pedido por su publicación). */
  protected readonly ownOffer = rxResource({
    params: () => {
      if (!this.order.hasValue()) {
        return undefined;
      }
      const { id, publishedAt } = this.order.value();
      return { id, publishedAt };
    },
    stream: ({ params }) => this.offersApi.findOwnForOrder(params.id, params.publishedAt),
  });

  /** La oferta que impide enviar otra: tras una vencida se puede volver a ofertar. */
  protected readonly existingOffer = computed(() => {
    const latest = this.ownOffer.hasValue() ? this.ownOffer.value() : null;
    return latest !== null && latest.status !== 'VENCIDA' ? latest : null;
  });

  protected readonly notFound = computed(() => {
    const status = apiErrorStatus(this.order.error());
    return status === 404 || status === 400;
  });
  protected readonly errorMessage = computed(() => {
    const error = this.order.error();
    return error === undefined || this.notFound()
      ? null
      : apiErrorMessages(error, LOAD_ERROR).join(' ');
  });

  protected retry(): void {
    this.order.reload();
  }
}

import { DatePipe, Location } from '@angular/common';
import { Component, computed, inject, linkedSignal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { OrderPhotoComponent } from '../../components/order-photo/order-photo.component';
import { OrderStatusBadgeComponent } from '../../components/order-status-badge/order-status-badge.component';
import { OrdersApiService } from '../../services/orders-api.service';
import { ordersListQueryFrom } from '../../models/orders-list-navigation.model';

const DETAIL_ERROR = 'No se pudo cargar el pedido. Compruebe su conexión e inténtelo de nuevo.';

/**
 * Detalle de un pedido propio (`GET /orders/me/:orderId`), solo lectura: datos del servicio,
 * dirección exacta (visible solo para el dueño), fotografías privadas e información del pedido.
 * Un pedido inexistente o ajeno responde 404 y se muestra como «no encontrado».
 */
@Component({
  selector: 'app-order-detail-page',
  imports: [DatePipe, RouterLink, OrderPhotoComponent, OrderStatusBadgeComponent],
  templateUrl: './order-detail-page.component.html',
  styleUrl: './order-detail-page.component.scss',
})
export class OrderDetailPageComponent {
  private readonly ordersApi = inject(OrdersApiService);

  protected readonly timezone = DISPLAY_TIMEZONE;

  private readonly orderId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('orderId') ?? '')),
    { requireSync: true },
  );

  /**
   * Filtro y página del listado desde el que se llegó, si los hay: se leen del estado de la
   * navegación en curso o, tras recargar o volver con el historial, del estado guardado.
   */
  protected readonly backQuery = ordersListQueryFrom(
    inject(Router).currentNavigation()?.extras.state ?? inject(Location).getState(),
  );

  protected readonly order = rxResource({
    params: () => this.orderId() || undefined,
    stream: ({ params }) => this.ordersApi.getOwn(params),
  });

  /** Fotografía ampliada: vuelve a la primera cuando cambia el pedido. */
  protected readonly selectedIndex = linkedSignal({
    source: () => (this.order.hasValue() ? this.order.value().id : null),
    computation: () => 0,
  });

  protected readonly selectedImage = computed(() => {
    if (!this.order.hasValue()) {
      return null;
    }
    const images = this.order.value().images;
    return images[Math.min(this.selectedIndex(), images.length - 1)] ?? null;
  });

  protected readonly errorStatus = computed(() => apiErrorStatus(this.order.error()));
  /** 404 (inexistente o ajeno) y 400 (identificador inválido) se muestran igual. */
  protected readonly notFound = computed(() => {
    const status = this.errorStatus();
    return status === 404 || status === 400;
  });
  protected readonly errorMessage = computed(() => {
    const error = this.order.error();
    if (error === undefined || this.notFound()) {
      return null;
    }
    return this.errorStatus() === 403
      ? apiErrorMessages(error, 'No tiene permiso para ver este pedido.').join(' ')
      : DETAIL_ERROR;
  });

  protected selectImage(index: number): void {
    this.selectedIndex.set(index);
  }

  protected retry(): void {
    this.order.reload();
  }
}

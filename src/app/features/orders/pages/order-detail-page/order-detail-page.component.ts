import { DatePipe, Location } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { SERVICE_AGREEMENT_STATUSES } from '../../../workflow/models/workflow.model';
import { OrderOffersComponent } from '../../../offers/components/order-offers/order-offers.component';
import { CancelOrderComponent } from '../../components/cancel-order/cancel-order.component';
import { OrderPhotoComponent } from '../../components/order-photo/order-photo.component';
import { OrderStatusBadgeComponent } from '../../components/order-status-badge/order-status-badge.component';
import {
  ORDER_AGREED_STATUSES,
  ORDER_STATUS_DESCRIPTIONS,
  OwnerOrder,
} from '../../models/order.model';
import { OrdersApiService } from '../../services/orders-api.service';
import {
  CANCELLATION_NOT_REGISTERED,
  CANCELLATION_UNCONFIRMED,
  CANCELLATION_VERIFIED,
} from '../../utils/cancellation-error';
import { ordersListQueryFrom } from '../../models/orders-list-navigation.model';

const DETAIL_ERROR = 'No se pudo cargar el pedido. Compruebe su conexión e inténtelo de nuevo.';

/**
 * Detalle de un pedido propio (`GET /orders/me/:orderId`): datos del servicio, dirección exacta
 * (visible solo para el dueño), fotografías privadas e información del pedido. Ofrece editar y
 * cancelar solo cuando el backend lo indica (`canEdit`, `canCancel`). Un pedido inexistente o
 * ajeno responde 404 y se muestra como «no encontrado».
 */
@Component({
  selector: 'app-order-detail-page',
  imports: [
    DatePipe,
    RouterLink,
    CancelOrderComponent,
    OrderOffersComponent,
    OrderPhotoComponent,
    OrderStatusBadgeComponent,
  ],
  templateUrl: './order-detail-page.component.html',
  styleUrl: './order-detail-page.component.scss',
})
export class OrderDetailPageComponent {
  private readonly ordersApi = inject(OrdersApiService);

  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly statusDescriptions = ORDER_STATUS_DESCRIPTIONS;

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

  /** Con acuerdo no se edita ni se cancela por esta vía: se explica por qué. */
  /** Con acuerdo alguna vez (o cancelado): hay un seguimiento que consultar. */
  protected readonly tracked = computed(() => {
    if (!this.order.hasValue()) {
      return false;
    }
    const { status } = this.order.value();
    return (
      SERVICE_AGREEMENT_STATUSES.includes(status) || status === 'CERRADO' || status === 'CANCELADO'
    );
  });
  protected readonly agreed = computed(
    () => this.order.hasValue() && ORDER_AGREED_STATUSES.includes(this.order.value().status),
  );

  /** Los avisos de una acción pertenecen a un pedido: se descartan al pasar a otro. */
  protected readonly actionErrors = linkedSignal<string, string[]>({
    source: this.orderId,
    computation: () => [],
  });
  /**
   * Cancelación sin confirmar: no se sabe si llegó a guardarse. Solo la resuelve una consulta del
   * pedido que responda; hasta entonces el aviso se mantiene y no se admite otro intento.
   */
  protected readonly unverified = linkedSignal({ source: this.orderId, computation: () => false });
  /**
   * Un resultado incierto se muestra aunque el pedido no se pueda cargar. Los demás rechazos
   * acompañan al pedido: sin él, la pantalla ya explica el problema y repetirlo confunde.
   */
  protected readonly shownErrors = computed(() => {
    if (this.unverified()) {
      return [CANCELLATION_UNCONFIRMED];
    }
    return this.order.hasValue() ? this.actionErrors() : [];
  });
  protected readonly cancelledMessage = linkedSignal<string, string | null>({
    source: this.orderId,
    computation: () => null,
  });

  constructor() {
    effect(() => {
      // Solo `resolved` es una respuesta: durante la recarga el pedido sigue siendo el anterior.
      if (this.unverified() && this.order.status() === 'resolved') {
        const cancelled = this.order.value()?.status === 'CANCELADO';
        untracked(() => this.onVerified(cancelled));
      }
    });
  }

  protected onCancelled(order: OwnerOrder): void {
    this.order.set(order);
    this.cancelledMessage.set('El pedido fue cancelado.');
    this.focusAfterRender('#order-cancelled');
  }

  protected onActionFailed(messages: string[]): void {
    const unknown = messages.includes(CANCELLATION_UNCONFIRMED);
    if (unknown) {
      this.unverified.set(true);
    }
    this.actionErrors.set(unknown ? [] : messages);
    if (messages.length > 0) {
      this.focusAfterRender('#order-action-error');
    }
  }

  /** Ya se conoce el estado real: se sustituye el aviso incierto por lo comprobado. */
  private onVerified(cancelled: boolean): void {
    this.unverified.set(false);
    if (cancelled) {
      this.cancelledMessage.set(CANCELLATION_VERIFIED);
      this.focusAfterRender('#order-cancelled');
    } else {
      this.actionErrors.set([CANCELLATION_NOT_REGISTERED]);
      this.focusAfterRender('#order-action-error');
    }
  }

  protected selectImage(index: number): void {
    this.selectedIndex.set(index);
  }

  protected retry(): void {
    this.order.reload();
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}

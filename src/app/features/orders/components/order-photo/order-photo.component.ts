import { Component, computed, inject, input } from '@angular/core';
import {
  ImageLoader,
  PrivateImageComponent,
} from '../../../../shared/components/private-image/private-image.component';
import { OrderImageVariant, OrderPhotoSource } from '../../models/order.model';
import { OrdersApiService } from '../../services/orders-api.service';

/**
 * Fotografía privada de un pedido (propio, disponible o asignado, según `source`), mostrada con
 * `app-private-image`.
 */
@Component({
  selector: 'app-order-photo',
  imports: [PrivateImageComponent],
  template: `
    <app-private-image
      [loader]="loader()"
      [imageId]="imageId()"
      [variant]="variant()"
      [alt]="alt()"
    />
  `,
  styles: `
    :host {
      display: grid;
      grid-template: minmax(0, 1fr) / minmax(0, 1fr);
      overflow: hidden;
    }
  `,
})
export class OrderPhotoComponent {
  private readonly ordersApi = inject(OrdersApiService);

  readonly orderId = input.required<string>();
  readonly imageId = input.required<string>();
  readonly variant = input<OrderImageVariant>('thumb');
  readonly alt = input.required<string>();
  readonly source = input<OrderPhotoSource>('own');

  protected readonly loader = computed((): ImageLoader => {
    const source = this.source();
    const orderId = this.orderId();
    return (imageId, variant) => this.ordersApi.getImage(source, orderId, imageId, variant);
  });
}

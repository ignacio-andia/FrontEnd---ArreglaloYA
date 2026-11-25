import { Component, computed, inject, input } from '@angular/core';
import { ImageGalleryComponent } from '../../../../shared/components/image-gallery/image-gallery.component';
import { ImageLoader } from '../../../../shared/components/private-image/private-image.component';
import { OrderImage, OrderPhotoSource } from '../../models/order.model';
import { OrdersApiService } from '../../services/orders-api.service';

/** Fotografías de un pedido que ve un trabajador: una ampliada y miniaturas para elegirla. */
@Component({
  selector: 'app-order-gallery',
  imports: [ImageGalleryComponent],
  template: ` <app-image-gallery subject="pedido" [images]="images()" [loader]="loader()" /> `,
})
export class OrderGalleryComponent {
  private readonly ordersApi = inject(OrdersApiService);

  readonly orderId = input.required<string>();
  readonly images = input.required<readonly OrderImage[]>();
  readonly source = input.required<OrderPhotoSource>();

  protected readonly loader = computed((): ImageLoader => {
    const source = this.source();
    const orderId = this.orderId();
    return (imageId, variant) => this.ordersApi.getImage(source, orderId, imageId, variant);
  });
}

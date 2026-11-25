import { Component, computed, input, linkedSignal } from '@angular/core';
import { OrderImage, OrderPhotoSource } from '../../models/order.model';
import { OrderPhotoComponent } from '../order-photo/order-photo.component';

/** Fotografías de un pedido que ve un trabajador: una ampliada y miniaturas para elegirla. */
@Component({
  selector: 'app-order-gallery',
  imports: [OrderPhotoComponent],
  template: `
    @if (selected(); as image) {
      <app-order-photo
        class="gallery__main"
        variant="full"
        [source]="source()"
        [orderId]="orderId()"
        [imageId]="image.id"
        [alt]="'Fotografía ' + image.position + ' de ' + images().length + ' del pedido'"
      />
      @if (images().length > 1) {
        <ul class="gallery__thumbs" aria-label="Elegir fotografía">
          @for (thumb of images(); track thumb.id; let index = $index) {
            <li>
              <button
                type="button"
                class="gallery__thumb"
                [attr.aria-pressed]="thumb.id === image.id"
                (click)="chosen.set(index)"
              >
                <app-order-photo
                  class="gallery__thumb-photo"
                  variant="thumb"
                  alt=""
                  [source]="source()"
                  [orderId]="orderId()"
                  [imageId]="thumb.id"
                />
                <span class="sr-only">Ver la fotografía {{ thumb.position }}</span>
              </button>
            </li>
          }
        </ul>
      }
    } @else {
      <p class="gallery__empty">El pedido no tiene fotografías disponibles.</p>
    }
  `,
  styles: `
    @use 'tokens';
    @use 'mixins';

    :host {
      display: grid;
      gap: tokens.$space-3;
    }

    .sr-only {
      @include mixins.visually-hidden;
    }

    .gallery__main {
      --order-photo-fit: contain;
      width: 100%;
      max-height: 24rem;
      aspect-ratio: 4 / 3;
      border-radius: tokens.$radius-md;
    }

    .gallery__thumbs {
      display: flex;
      flex-wrap: wrap;
      gap: tokens.$space-2;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .gallery__thumb {
      padding: 2px;
      border: 2px solid transparent;
      border-radius: tokens.$radius-md;
      background: none;
      cursor: pointer;

      &[aria-pressed='true'] {
        border-color: var(--color-primary);
      }
    }

    .gallery__thumb-photo {
      width: 4.5rem;
      height: 4.5rem;
    }

    .gallery__empty {
      color: var(--color-text-secondary);
    }
  `,
})
export class OrderGalleryComponent {
  readonly orderId = input.required<string>();
  readonly images = input.required<readonly OrderImage[]>();
  readonly source = input.required<OrderPhotoSource>();

  /** Fotografía ampliada: vuelve a la primera cuando cambia el pedido. */
  protected readonly chosen = linkedSignal({ source: this.orderId, computation: () => 0 });
  protected readonly selected = computed(() => {
    const images = this.images();
    return images[Math.min(this.chosen(), images.length - 1)] ?? null;
  });
}

import { Component, computed, input, linkedSignal } from '@angular/core';
import { ImageLoader, PrivateImageComponent } from '../private-image/private-image.component';

export interface GalleryImage {
  id: string;
  position: number;
}

/** Fotografías privadas: una ampliada y miniaturas para elegirla. */
@Component({
  selector: 'app-image-gallery',
  imports: [PrivateImageComponent],
  template: `
    @if (selected(); as image) {
      <app-private-image
        class="gallery__main"
        variant="full"
        [loader]="loader()"
        [imageId]="image.id"
        [alt]="'Fotografía ' + image.position + ' de ' + images().length + ' del ' + subject()"
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
                <app-private-image
                  class="gallery__thumb-photo"
                  variant="thumb"
                  alt=""
                  [loader]="loader()"
                  [imageId]="thumb.id"
                />
                <span class="sr-only">Ver la fotografía {{ thumb.position }}</span>
              </button>
            </li>
          }
        </ul>
      }
    } @else {
      <p class="gallery__empty">El {{ subject() }} no tiene fotografías disponibles.</p>
    }
  `,
  styles: `
    @use 'tokens';
    @use 'mixins';

    :host {
      display: grid;
      gap: tokens.$space-3;
      min-width: 0;
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
export class ImageGalleryComponent {
  readonly images = input.required<readonly GalleryImage[]>();
  readonly loader = input.required<ImageLoader>();
  /** A qué pertenecen, en singular masculino: «pedido», «reclamo». */
  readonly subject = input.required<string>();

  /** Fotografía ampliada: vuelve a la primera cuando cambian las imágenes. */
  protected readonly chosen = linkedSignal({ source: this.loader, computation: () => 0 });
  protected readonly selected = computed(() => {
    const images = this.images();
    return images[Math.min(this.chosen(), images.length - 1)] ?? null;
  });
}

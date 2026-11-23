import { Component, computed, inject, input } from '@angular/core';
import { PhotoPreviewService } from '../../services/photo-preview.service';

/** Datos del pedido tal como se van a publicar, con los nombres visibles de los catálogos. */
export interface OrderDraftView {
  categoryName: string;
  zoneName: string;
  description: string;
  budgetAmount: string;
  addressLine: string;
  addressReference: string | null;
  images: readonly File[];
}

/**
 * Resumen del pedido antes de publicarlo. Solo presenta los datos; la confirmación la decide la
 * página. Las vistas previas comparten las URLs del selector (`PhotoPreviewService`).
 */
@Component({
  selector: 'app-order-review',
  template: `
    <dl class="review">
      <div class="review__item">
        <dt>Categoría</dt>
        <dd>{{ draft().categoryName }}</dd>
      </div>
      <div class="review__item">
        <dt>Zona</dt>
        <dd>{{ draft().zoneName }}</dd>
      </div>
      <div class="review__item">
        <dt>Presupuesto</dt>
        <dd>Bs {{ draft().budgetAmount }}</dd>
      </div>
      <div class="review__item review__item--wide">
        <dt>Descripción</dt>
        <dd class="review__text">{{ draft().description }}</dd>
      </div>
      <div class="review__item review__item--wide">
        <dt>Dirección exacta</dt>
        <dd>
          {{ draft().addressLine }}
          @if (draft().addressReference; as reference) {
            <span class="review__reference">Referencia: {{ reference }}</span>
          }
        </dd>
      </div>
      <div class="review__item review__item--wide">
        <dt>Fotografías ({{ draft().images.length }})</dt>
        <dd>
          <ul class="review__photos">
            @for (photo of photos(); track photo.file; let index = $index) {
              <li class="review__photo">
                @if (photo.url; as url) {
                  <img [src]="url" [alt]="'Fotografía ' + (index + 1) + ': ' + photo.file.name" />
                } @else {
                  <span>{{ photo.file.name }}</span>
                }
              </li>
            }
          </ul>
        </dd>
      </div>
    </dl>
  `,
  styles: `
    @use 'tokens';
    @use 'mixins';

    :host {
      display: block;
    }

    .review {
      display: grid;
      gap: tokens.$space-4;
      margin: 0;

      @include mixins.respond-up(md) {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    .review__item {
      display: grid;
      gap: tokens.$space-1;
      min-width: 0;

      dt {
        color: var(--color-text-secondary);
        font-size: 0.875rem;
        font-weight: tokens.$font-weight-medium;
      }

      dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
    }

    .review__item--wide {
      grid-column: 1 / -1;
    }

    .review__text {
      white-space: pre-line;
    }

    .review__reference {
      display: block;
      color: var(--color-text-secondary);
    }

    .review__photos {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: tokens.$space-2;
      max-width: 32rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .review__photo {
      display: grid;
      place-items: center;
      aspect-ratio: 1;
      overflow: hidden;
      border: 1px solid var(--color-border);
      border-radius: tokens.$radius-sm;
      background-color: var(--color-background);
      font-size: 0.75rem;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
  `,
})
export class OrderReviewComponent {
  private readonly previews = inject(PhotoPreviewService);

  readonly draft = input.required<OrderDraftView>();

  protected readonly photos = computed(() =>
    this.draft().images.map((file) => ({ file, url: this.previews.urlFor(file) })),
  );
}

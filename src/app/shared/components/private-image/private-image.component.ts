import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, map } from 'rxjs';

export type ImageVariant = 'full' | 'thumb';

/** Descarga una imagen privada. Debe ser una función estable: si cambia, se vuelve a pedir. */
export type ImageLoader = (imageId: string, variant: ImageVariant) => Observable<Blob>;

/**
 * Imagen privada: se descarga como Blob con HttpClient (el interceptor agrega el token Bearer) y
 * se muestra con una URL `blob:` local, que se libera al cambiar de imagen y al destruir el
 * componente. Mientras carga, o si falla, muestra un marcador.
 */
@Component({
  selector: 'app-private-image',
  template: `
    @if (url(); as url) {
      <img class="photo__image" [src]="url" [alt]="alt()" />
    } @else if (photo.isLoading()) {
      <span class="photo__placeholder" role="status">
        <span class="photo__spinner" aria-hidden="true"></span>
        <span class="sr-only">Cargando fotografía</span>
      </span>
    } @else {
      <span class="photo__placeholder photo__placeholder--error">Imagen no disponible</span>
    }
  `,
  styles: `
    @use 'tokens';
    @use 'mixins';

    :host {
      display: grid;
      // La celda toma el tamaño del contenedor: la fotografía se ajusta dentro sin desbordarlo.
      grid-template: minmax(0, 1fr) / minmax(0, 1fr);
      place-items: center;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      background-color: var(--color-background);
    }

    .sr-only {
      @include mixins.visually-hidden;
    }

    .photo__image {
      width: 100%;
      height: 100%;
      object-fit: var(--order-photo-fit, cover);
    }

    .photo__placeholder {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      padding: tokens.$space-2;
      color: var(--color-text-secondary);
      font-size: 0.8125rem;
      text-align: center;
    }

    .photo__spinner {
      width: 1.5rem;
      height: 1.5rem;
      border: 3px solid var(--color-primary-pale);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      .photo__spinner {
        animation: none;
      }
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class PrivateImageComponent {
  private readonly urlApi = inject(DOCUMENT).defaultView?.URL;

  readonly loader = input.required<ImageLoader>();
  readonly imageId = input.required<string>();
  readonly variant = input<ImageVariant>('thumb');
  readonly alt = input.required<string>();

  /** URL `blob:` vigente, para liberarla al reemplazarla o al destruir el componente. */
  private currentUrl: string | null = null;

  protected readonly photo = rxResource({
    params: () => ({ loader: this.loader(), imageId: this.imageId(), variant: this.variant() }),
    stream: ({ params }) =>
      params.loader(params.imageId, params.variant).pipe(map((blob) => this.replaceUrl(blob))),
  });

  protected readonly url = computed(() => (this.photo.hasValue() ? this.photo.value() : null));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revoke());
  }

  private replaceUrl(blob: Blob): string | null {
    this.revoke();
    if (typeof this.urlApi?.createObjectURL !== 'function') {
      return null;
    }
    this.currentUrl = this.urlApi.createObjectURL(blob);
    return this.currentUrl;
  }

  private revoke(): void {
    if (this.currentUrl !== null) {
      this.urlApi?.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }
}

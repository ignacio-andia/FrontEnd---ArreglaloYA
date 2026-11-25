import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { OfferParty } from '../../models/offer.model';
import { OffersApiService } from '../../services/offers-api.service';

const CONTACT_ERROR = 'El contacto no está disponible en este momento.';

const UNAVAILABLE_REASONS = {
  TELEFONO_NO_REGISTRADO: 'La otra parte no registró un teléfono.',
  TELEFONO_INVALIDO: 'El teléfono registrado no permite abrir WhatsApp.',
} as const;

/**
 * Contacto por WhatsApp de la otra parte. El enlace lo construye el backend y solo se muestra
 * cuando responde `available: true`; si lo niega (403 o 409) se explica con su mensaje.
 */
@Component({
  selector: 'app-whatsapp-contact',
  imports: [LoadingStateComponent],
  template: `
    @if (contact.isLoading()) {
      <app-loading-state message="Consultando el contacto…" />
    } @else if (errorMessage(); as message) {
      <p class="contact__unavailable">{{ message }}</p>
    } @else if (contact.hasValue()) {
      @let current = contact.value();
      @if (current.available) {
        <a class="contact__link" [href]="current.url" target="_blank" rel="noopener noreferrer">
          Contactar {{ current.contactRole === 'CLIENTE' ? 'al cliente' : 'al trabajador' }} por
          WhatsApp<span class="sr-only"> (se abre en una pestaña nueva)</span>
        </a>
        <p class="contact__unavailable">
          WhatsApp es un canal externo: la plataforma no envía ni registra los mensajes.
        </p>
      } @else {
        <p class="contact__unavailable">{{ reasons[current.reason] }}</p>
      }
    }
  `,
  styles: `
    @use 'tokens';
    @use 'mixins';
    @use 'buttons';

    :host {
      display: grid;
      justify-items: start;
      gap: tokens.$space-2;
    }

    .sr-only {
      @include mixins.visually-hidden;
    }

    .contact__link {
      @include buttons.primary;
    }

    .contact__unavailable {
      color: var(--color-text-secondary);
      font-size: 0.875rem;
    }
  `,
})
export class WhatsappContactComponent {
  private readonly offersApi = inject(OffersApiService);

  readonly offerId = input.required<string>();
  /** Quién consulta: el cliente contacta al trabajador y viceversa. */
  readonly viewer = input.required<OfferParty>();

  protected readonly reasons = UNAVAILABLE_REASONS;

  protected readonly contact = rxResource({
    params: () => ({ offerId: this.offerId(), viewer: this.viewer() }),
    stream: ({ params }) =>
      params.viewer === 'CLIENTE'
        ? this.offersApi.getWorkerContact(params.offerId)
        : this.offersApi.getClientContact(params.offerId),
  });

  protected readonly errorMessage = computed(() => {
    const error = this.contact.error();
    return error === undefined ? null : apiErrorMessages(error, CONTACT_ERROR).join(' ');
  });
}

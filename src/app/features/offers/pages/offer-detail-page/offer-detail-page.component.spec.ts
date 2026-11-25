import { ownerOrder } from '../../../orders/testing/order.fixtures';
import { OfferDetail, OfferEvent, ReceivedOffer } from '../../models/offer.model';
import { OWN_OFFERS_ROUTES, RECEIVED_OFFERS_ROUTES } from '../../offers.routes';
import {
  OFFER_ID,
  ORDER_ID,
  PROPOSAL,
  detail,
  setupOfferPage,
  workerOrder,
} from '../../testing/offers.fixtures';

const ROUTES = [
  { path: 'cliente/ofertas', children: RECEIVED_OFFERS_ROUTES },
  { path: 'trabajador/ofertas', children: OWN_OFFERS_ROUTES },
];
const CONTACT_URL = 'https://wa.me/59170000000?text=Hola';

function counter(round: number, amount: string, role: 'CLIENTE' | 'TRABAJADOR'): OfferEvent {
  return {
    ...PROPOSAL,
    type: 'CONTRAOFERTA',
    round,
    amount,
    actorRole: role,
    createdAt: `2026-11-20T1${round + 3}:00:00.000Z`,
  };
}

describe('OfferDetailPageComponent', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  async function contact(side: 'received' | 'me', available = true): Promise<void> {
    await view.answer(
      `offers/${side}/${OFFER_ID}/whatsapp`,
      available
        ? { available: true, channel: 'WHATSAPP', contactRole: 'TRABAJADOR', url: CONTACT_URL }
        : {
            available: false,
            channel: 'WHATSAPP',
            contactRole: 'TRABAJADOR',
            url: null,
            reason: 'TELEFONO_NO_REGISTRADO',
          },
    );
  }

  /** Abre el detalle respondiendo la oferta, el contacto y el pedido. */
  async function openAsClient(offer: OfferDetail<ReceivedOffer>): Promise<void> {
    await view.visit(`/cliente/ofertas/${OFFER_ID}`);
    await view.answer(`offers/received/${OFFER_ID}`, offer);
    if (offer.status === 'VIGENTE' || offer.status === 'ACEPTADA') {
      await contact('received');
    }
    await view.answer(`orders/me/${ORDER_ID}`, ownerOrder());
  }

  async function openAsWorker(offer: OfferDetail<ReceivedOffer>): Promise<void> {
    await view.visit(`/trabajador/ofertas/${OFFER_ID}`);
    await view.answer(`offers/me/${OFFER_ID}`, offer);
    if (offer.status === 'VIGENTE') {
      await contact('me');
    }
    await view.answer(`orders/available/${ORDER_ID}`, workerOrder());
  }

  const accept = () => view.element('.actions__accept');
  const counterInput = () => view.element('#offer-counter-amount');
  const confirm = () => view.click('dialog[open] .dialog__confirm');

  describe('as the client', () => {
    beforeEach(async () => {
      view = await setupOfferPage(ROUTES, 'CLIENTE');
    });

    it('shows the offer terms, validity, round and WhatsApp link from the backend', async () => {
      await openAsClient(detail());

      expect(view.text('h1')).toBe('Oferta de Luis Rojas');
      const content = view.content();
      expect(content).toContain('Bs 180.00');
      expect(content).toContain('30/11/2026 10:00');
      expect(content).toContain('1 h 30 min');
      expect(content).toContain('Requiere visita');
      expect(content).toContain('Gratis');
      expect(content).toContain('1 de 3');
      expect(content).toContain('Vence el21/11/2026 10:00');
      expect(content).toContain('Le toca responder a usted');
      expect(view.element('.contact__link')?.getAttribute('href')).toBe(CONTACT_URL);
      expect(accept()).not.toBeNull();
      expect(view.element('.actions__reject')?.textContent).toContain('Rechazar');
      expect(counterInput()).not.toBeNull();
    });

    it('asks for confirmation before accepting and shows the accepted offer', async () => {
      await openAsClient(detail());

      await view.click('.actions__accept');
      expect(view.text('dialog[open]')).toContain('las demás ofertas quedarán sin efecto');
      view.http.expectNone((request) => request.method === 'POST');

      await confirm();
      const request = await view.request('POST', 'offers', OFFER_ID, 'accept');
      await view.click('dialog[open] .dialog__confirm');
      view.http.expectNone((pending) => pending.method === 'POST');
      request.flush(detail({ status: 'ACEPTADA', closedAt: '2026-11-20T15:00:00.000Z' }));
      await view.render();

      expect(view.content()).toContain('El trabajador quedó asignado al pedido');
      expect(view.text('app-offer-status-badge')).toContain('Aceptada');
      expect(accept()).toBeNull();
      expect(counterInput()).toBeNull();
    });

    it('does nothing when the confirmation is dismissed', async () => {
      await openAsClient(detail());
      await view.click('.actions__reject');
      await view.click('dialog[open] .dialog__cancel');

      expect(view.element('dialog[open]')).toBeNull();
    });

    it('rejects after confirmation', async () => {
      await openAsClient(detail());
      await view.click('.actions__reject');
      await confirm();
      (await view.request('POST', 'offers', OFFER_ID, 'reject')).flush(
        detail({ status: 'RECHAZADA' }),
      );
      await view.render();

      expect(view.content()).toContain('Oferta rechazada');
      expect(view.element('.actions button')).toBeNull();
      expect(view.element('app-whatsapp-contact')).toBeNull();
    });

    it('validates the counteroffer and shows old and new amounts before sending', async () => {
      await openAsClient(detail());

      await view.type('#offer-counter-amount', '-5');
      await view.click('.actions__secondary');
      expect(view.content()).toContain('Ingrese un monto mayor que 0');
      expect(view.element('dialog[open]')).toBeNull();

      await view.type('#offer-counter-amount', '160,50');
      await view.click('.actions__secondary');
      expect(view.text('dialog[open]')).toContain('de Bs 180.00 a Bs 160.50');
      await confirm();

      const request = await view.request('POST', 'offers', OFFER_ID, 'counter');
      expect(request.request.body).toEqual({ amount: '160.50' });
      request.flush(
        detail({ round: 2, amount: '160.50', turn: 'TRABAJADOR' }, [
          PROPOSAL,
          counter(2, '160.50', 'CLIENTE'),
        ]),
      );
      await view.render();

      expect(view.content()).toContain('Le toca responder al trabajador');
      expect(accept()).toBeNull();
      expect(counterInput()).toBeNull();
    });

    it('offers no actions out of turn', async () => {
      await openAsClient(detail({ turn: 'TRABAJADOR', round: 2 }));

      expect(view.element('.actions button')).toBeNull();
      expect(view.content()).toContain('cuando el trabajador responda');
    });

    it('allows no more counteroffers after the third round', async () => {
      await openAsClient(detail({ round: 3 }));

      expect(accept()).not.toBeNull();
      expect(counterInput()).toBeNull();
      expect(view.content()).toContain('máximo de 3 rondas');
    });

    it.each(['RECHAZADA', 'RETIRADA', 'VENCIDA', 'SIN_EFECTO'] as const)(
      'is read only when the offer is %s',
      async (status) => {
        await openAsClient(detail({ status }));

        expect(view.element('.actions button')).toBeNull();
        expect(view.element('app-whatsapp-contact')).toBeNull();
        expect(view.element('app-negotiation-timeline')).not.toBeNull();
      },
    );

    it('shows the history in order with author, amounts and resulting state', async () => {
      await openAsClient(
        detail({ round: 3, amount: '170.00' }, [
          PROPOSAL,
          counter(2, '160.00', 'CLIENTE'),
          counter(3, '170.00', 'TRABAJADOR'),
        ]),
      );

      const entries = [...view.root().querySelectorAll('.timeline__item')].map((item) =>
        item.textContent?.replace(/\s+/g, ' '),
      );
      expect(entries).toHaveLength(3);
      expect(entries[0]).toContain('Propuesta inicial');
      expect(entries[1]).toContain('(usted)');
      expect(entries[1]).toContain('Bs 160.00');
      expect(entries[1]).toContain('antes Bs 180.00');
      expect(entries[2]).toContain('20/11/2026 12:00');
      expect(entries[2]).toContain('Estado resultante: Vigente');
    });

    it('reports an agenda conflict on accept and reloads the offer', async () => {
      await openAsClient(detail());
      await view.click('.actions__accept');
      await confirm();
      await view.fail(
        `offers/${OFFER_ID}/accept`,
        409,
        'El trabajador ya tiene un trabajo en ese horario',
        'POST',
      );

      expect(view.text('[role="alert"]')).toContain('ya tiene un trabajo en ese horario');
      await view.answer(`offers/received/${OFFER_ID}`, detail());
    });

    it('explains an unavailable contact', async () => {
      await view.visit(`/cliente/ofertas/${OFFER_ID}`);
      await view.answer(`offers/received/${OFFER_ID}`, detail());
      await contact('received', false);
      await view.answer(`orders/me/${ORDER_ID}`, ownerOrder());

      expect(view.element('.contact__link')).toBeNull();
      expect(view.content()).toContain('no registró un teléfono');
    });

    it('hides someone else’s offer', async () => {
      await view.visit(`/cliente/ofertas/${OFFER_ID}`);
      await view.fail(`offers/received/${OFFER_ID}`, 404);

      expect(view.text('h1')).toBe('Oferta no encontrada');
    });

    it('retries after a load error', async () => {
      await view.visit(`/cliente/ofertas/${OFFER_ID}`);
      await view.fail(`offers/received/${OFFER_ID}`, 500);

      await view.click('app-error-alert button');
      await view.answer(`offers/received/${OFFER_ID}`, detail({ status: 'VENCIDA' }));
      await view.answer(`orders/me/${ORDER_ID}`, ownerOrder());
      expect(view.content()).toContain('Venció el');
    });
  });

  describe('as the worker', () => {
    beforeEach(async () => {
      view = await setupOfferPage(ROUTES, 'TRABAJADOR');
    });

    it('can only withdraw while the client has the turn', async () => {
      await openAsWorker(detail());

      expect(accept()).toBeNull();
      expect(counterInput()).toBeNull();
      expect(view.text('.actions__reject')).toBe('Retirar oferta');
    });

    it('answers a counteroffer but can neither accept nor reject it', async () => {
      await openAsWorker(
        detail({ turn: 'TRABAJADOR', round: 2, amount: '160.00' }, [
          PROPOSAL,
          counter(2, '160.00', 'CLIENTE'),
        ]),
      );

      expect(view.content()).toContain('Le toca responder a usted');
      expect(view.content()).toContain('Solo el cliente puede aceptar o rechazar');
      expect(accept()).toBeNull();
      expect(counterInput()).not.toBeNull();
      expect(view.root().querySelectorAll('.actions__reject')).toHaveLength(1);
    });

    it('withdraws after confirmation', async () => {
      await openAsWorker(detail());
      await view.click('.actions__reject');
      await confirm();
      (await view.request('POST', 'offers', OFFER_ID, 'withdraw')).flush(
        detail({ status: 'RETIRADA' }),
      );
      await view.render();

      expect(view.content()).toContain('Retiró su oferta');
      expect(view.element('.actions button')).toBeNull();
    });

    it('reports a repeated action and refreshes the state', async () => {
      await openAsWorker(detail());
      await view.click('.actions__reject');
      await confirm();
      await view.fail(`offers/${OFFER_ID}/withdraw`, 409, 'La oferta ya no está vigente', 'POST');

      expect(view.text('[role="alert"]')).toContain('ya no está vigente');
      await view.answer(`offers/me/${OFFER_ID}`, detail({ status: 'SIN_EFECTO' }));
      expect(view.element('.actions button')).toBeNull();
    });

    it('shows the exact address only once the offer is accepted', async () => {
      await view.visit(`/trabajador/ofertas/${OFFER_ID}`);
      await view.answer(`offers/me/${OFFER_ID}`, detail({ status: 'ACEPTADA' }));
      await contact('me');
      await view.answer(`orders/assigned/${ORDER_ID}`, {
        ...workerOrder({ status: 'ACORDADO' }),
        address: { addressLine: 'Av. Ejemplo 123', reference: 'Portón verde' },
        client: { id: 'client', firstName: 'Ana', lastName: 'Pérez' },
      });

      expect(view.content()).toContain('Av. Ejemplo 123');
      expect(view.content()).toContain('Ana Pérez');
    });

    it('keeps the offer visible when its order is no longer available', async () => {
      await view.visit(`/trabajador/ofertas/${OFFER_ID}`);
      await view.answer(`offers/me/${OFFER_ID}`, detail({ status: 'SIN_EFECTO' }));
      await view.fail(`orders/available/${ORDER_ID}`, 404);

      expect(view.content()).toContain('El pedido ya no está disponible');
      expect(view.content()).toContain('Historial de negociación');
    });
  });
});

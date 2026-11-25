import { apiUrl } from '../../../../core/http/api-url';
import { OWN_OFFERS_ROUTES, RECEIVED_OFFERS_ROUTES } from '../../offers.routes';
import {
  ORDER_ID,
  offer,
  page,
  received,
  setupOfferPage,
  workerOrder,
} from '../../testing/offers.fixtures';
import { OFFER_STATUSES, OFFER_STATUS_LABELS } from '../../models/offer.model';

const ROUTES = [
  { path: 'cliente/ofertas', children: RECEIVED_OFFERS_ROUTES },
  { path: 'trabajador/ofertas', children: OWN_OFFERS_ROUTES },
];

describe('OffersPageComponent', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  /** Abre el listado y devuelve la consulta de ofertas pendiente. */
  async function open(url: string, list: 'received' | 'me') {
    await view.visit(url);
    return view.request('GET', 'offers', list);
  }

  /** Responde la consulta de pedidos que titula las tarjetas mostradas. */
  async function titles(list: 'me' | 'available', orders = [workerOrder()]) {
    await view.answer(`orders/${list}`, page(orders, orders.length, 50));
  }

  describe('received offers (client)', () => {
    beforeEach(async () => {
      view = await setupOfferPage(ROUTES, 'CLIENTE');
    });

    it('shows loading, then each offer with worker, price, status, dates and turn', async () => {
      const request = await open('/cliente/ofertas', 'received');
      expect(request.request.params.toString()).toBe('page=1&limit=12');
      expect(view.content()).toContain('Cargando las ofertas');

      request.flush(page([received()]));
      await view.render();
      await titles('me');

      expect(view.text('h1')).toBe('Ofertas recibidas');
      const card = view.text('.offer');
      expect(card).toContain('Bs 180.00');
      expect(card).toContain('Plomería');
      expect(card).toContain('Luis Rojas');
      expect(card).toContain('Vigente');
      expect(card).toContain('Le toca responder');
      expect(card).toContain('30/11/2026 10:00');
      expect(card).toContain('21/11/2026 10:00');
      expect(view.element('.offer--open')).not.toBeNull();
      expect(view.element('.offer__link')?.getAttribute('href')).toBe(
        `/cliente/ofertas/${received().id}`,
      );
    });

    it('labels the six backend states and highlights only the open one', async () => {
      const request = await open('/cliente/ofertas', 'received');
      request.flush(
        page(OFFER_STATUSES.map((status, index) => received({ id: `offer-${index}`, status }))),
      );
      await view.render();
      await titles('me');

      for (const status of OFFER_STATUSES) {
        expect(view.content()).toContain(OFFER_STATUS_LABELS[status]);
      }
      expect(view.root().querySelectorAll('.offer--open')).toHaveLength(1);
    });

    it('filters by status and order, keeping both in the URL', async () => {
      const first = await open(`/cliente/ofertas?pedido=${ORDER_ID}`, 'received');
      expect(first.request.params.get('orderId')).toBe(ORDER_ID);
      first.flush(page([received()]));
      await view.render();
      await titles('me');
      expect(view.content()).toContain('Mostrando las ofertas de un pedido');

      await view.type('#offers-status', 'VENCIDA');
      const filtered = await view.request('GET', 'offers', 'received');
      expect(filtered.request.params.get('status')).toBe('VENCIDA');
      expect(view.router.url).toContain('estado=VENCIDA');
      filtered.flush(page([]));
      await view.render();
      expect(view.content()).toContain('No hay ofertas con ese filtro');

      await view.click('app-empty-state button');
      (await view.request('GET', 'offers', 'received')).flush(page([received()]));
      await view.render();
      await titles('me');
      expect(view.router.url).toBe('/cliente/ofertas');
    });

    it('paginates', async () => {
      const first = await open('/cliente/ofertas', 'received');
      first.flush(page([received()], 20));
      await view.render();
      await titles('me');

      const next = [...view.root().querySelectorAll<HTMLButtonElement>('app-paginator button')];
      next.at(-1)?.click();
      await view.render();

      const second = await view.request('GET', 'offers', 'received');
      expect(second.request.params.get('page')).toBe('2');
      second.flush(page([received()], 20));
      await view.render();
      await titles('me');
    });

    it('searches further order pages until every shown offer has its title', async () => {
      (await open('/cliente/ofertas', 'received')).flush(page([received()]));
      await view.render();

      const first = await view.request('GET', 'orders', 'me');
      first.flush({
        data: [workerOrder({ id: 'otro' })],
        meta: { page: 1, limit: 50, total: 51, totalPages: 2 },
      });
      await view.render();
      const second = await view.request('GET', 'orders', 'me');
      expect(second.request.params.get('page')).toBe('2');
      second.flush({
        data: [workerOrder()],
        meta: { page: 2, limit: 50, total: 51, totalPages: 2 },
      });
      await view.render();

      expect(view.text('.offer__title')).toContain('Plomería');
    });

    it('explains an empty list', async () => {
      (await open('/cliente/ofertas', 'received')).flush(page([]));
      await view.render();

      expect(view.content()).toContain('Todavía no recibió ofertas');
    });

    it('shows the error with a retry', async () => {
      await view.visit('/cliente/ofertas');
      await view.fail('offers/received', 500, 'Fallo del servidor');
      expect(view.element('app-error-alert')).not.toBeNull();

      await view.click('app-error-alert button');
      await view.answer('offers/received', page([received()]));
      await titles('me');
      expect(view.content()).toContain('Luis Rojas');
    });
  });

  describe('own offers (worker)', () => {
    beforeEach(async () => {
      view = await setupOfferPage(ROUTES, 'TRABAJADOR');
    });

    it('lists the sent offers and says who must answer', async () => {
      const request = await open('/trabajador/ofertas?pedido=ignorado', 'me');
      expect(request.request.url).toBe(apiUrl('offers', 'me'));
      expect(request.request.params.has('orderId')).toBe(false);
      request.flush(page([offer()]));
      await view.render();
      await titles('available');

      expect(view.text('h1')).toBe('Mis ofertas');
      expect(view.content()).toContain('Esperando respuesta del cliente');
      expect(view.content()).not.toContain('Le toca responder');
    });

    it('still lists offers when the order titles cannot be loaded', async () => {
      await view.visit('/trabajador/ofertas');
      await view.answer('offers/me', page([offer()]));
      await view.fail('orders/available', 403);

      expect(view.text('.offer__title')).toBe('Pedido');
    });

    it('links to the available orders when there are no offers', async () => {
      (await open('/trabajador/ofertas', 'me')).flush(page([]));
      await view.render();

      expect(view.element('app-empty-state a')?.getAttribute('href')).toBe('/trabajador/pedidos');
    });
  });
});

import { CATEGORY } from '../../../orders/testing/order.fixtures';
import { AVAILABLE_ORDERS_ROUTES } from '../../offers.routes';
import { ORDER_ID, offer, page, setupOfferPage, workerOrder } from '../../testing/offers.fixtures';

const ELIGIBLE = {
  eligible: true,
  canTakeNewWork: true,
  status: 'APROBADO',
  message: 'Perfil aprobado',
  reason: null,
  pendingZoneChangeRequest: null,
};

describe('available orders', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  beforeEach(async () => {
    view = await setupOfferPage(
      [
        { path: 'trabajador/pedidos', children: AVAILABLE_ORDERS_ROUTES },
        { path: 'trabajador', children: [] },
      ],
      'TRABAJADOR',
    );
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  async function openList(canTakeNewWork = true) {
    await view.visit('/trabajador/pedidos');
    await view.answer('worker-profile/me/eligibility', ELIGIBLE);
    await view.answer('catalogs/categories', [CATEGORY]);
    await view.answer('worker-profile/me/eligibility', { ...ELIGIBLE, canTakeNewWork });
    return view.request('GET', 'orders', 'available');
  }

  async function openDetail(offers: object[] = []): Promise<void> {
    await view.visit(`/trabajador/pedidos/${ORDER_ID}`);
    await view.answer('worker-profile/me/eligibility', ELIGIBLE);
    await view.answer(`orders/available/${ORDER_ID}`, workerOrder());
    await view.answer('offers/me', page(offers, offers.length, 50));
  }

  it('keeps an unapproved worker out', async () => {
    await view.visit('/trabajador/pedidos');
    await view.answer('worker-profile/me/eligibility', { ...ELIGIBLE, eligible: false });

    expect(view.router.url).toBe('/trabajador');
  });

  it('lists category, description, budget, zone and dates without any address', async () => {
    (await openList()).flush(page([workerOrder()]));
    await view.render();

    const card = view.text('.request');
    expect(card).toContain('Plomería');
    expect(card).toContain('Fuga de agua');
    expect(card).toContain('Bs 150.50');
    expect(card).toContain('Norte');
    expect(card).toContain('15/11/2026');
    expect(card).toContain('22/11/2026 10:40');
    expect(card).not.toContain('Av. Ejemplo');
    expect(view.element('.request__link')?.getAttribute('href')).toBe(
      `/trabajador/pedidos/${ORDER_ID}`,
    );
  });

  it('filters by category and explains an empty result', async () => {
    (await openList()).flush(page([workerOrder()]));
    await view.render();
    await view.type('#available-category', CATEGORY.id);

    const filtered = await view.request('GET', 'orders', 'available');
    expect(filtered.request.params.get('categoryId')).toBe(CATEGORY.id);
    filtered.flush(page([]));
    await view.render();
    expect(view.content()).toContain('No hay pedidos disponibles');
  });

  it('warns while new work is blocked and retries after an error', async () => {
    (await openList(false)).flush(
      { statusCode: 500, message: 'Fallo' },
      { status: 500, statusText: 'Error' },
    );
    await view.render();
    expect(view.content()).toContain('no puede tomar trabajos nuevos');

    await view.click('app-error-alert button');
    await view.answer('orders/available', page([]));
  });

  it('shows the order and the access to send an offer', async () => {
    await openDetail();

    expect(view.text('h1')).toBe('Plomería');
    expect(view.element('.offers__primary')?.getAttribute('href')).toBe(
      `/trabajador/pedidos/${ORDER_ID}/ofertar`,
    );
  });

  it('links to the existing offer instead of offering again', async () => {
    await openDetail([offer({ status: 'RETIRADA' })]);

    expect(view.content()).toContain('Ya tiene una oferta');
    expect(view.element('.offers__primary')).toBeNull();
  });

  it('allows offering again after an expired offer', async () => {
    await openDetail([offer({ status: 'VENCIDA' })]);

    expect(view.element('.offers__primary')).not.toBeNull();
  });

  /** Página de 50 ofertas ajenas al pedido, creadas en la fecha indicada. */
  function otherOffers(number: number, createdAt: string) {
    return {
      data: Array.from({ length: 50 }, (_, index) =>
        offer({ id: `${number}-${index}`, orderId: 'otro', createdAt }),
      ),
      meta: { page: number, limit: 50, total: 150, totalPages: 3 },
    };
  }

  async function openWithPages(...pages: object[]): Promise<void> {
    await view.visit(`/trabajador/pedidos/${ORDER_ID}`);
    await view.answer('worker-profile/me/eligibility', ELIGIBLE);
    await view.answer(`orders/available/${ORDER_ID}`, workerOrder());
    for (const [index, body] of pages.entries()) {
      const request = await view.request('GET', 'offers', 'me');
      expect(request.request.params.get('page')).toBe(String(index + 1));
      // Mientras se comprueba no se afirma nada sobre el envío.
      expect(view.element('.offers__primary')).toBeNull();
      request.flush(body);
      await view.render();
    }
  }

  it('finds an existing offer beyond the first 50', async () => {
    await openWithPages(otherOffers(1, '2026-11-20T10:00:00.000Z'), {
      data: [offer({ status: 'RECHAZADA' })],
      meta: { page: 2, limit: 50, total: 51, totalPages: 2 },
    });

    expect(view.content()).toContain('Ya tiene una oferta');
    expect(view.element('.offers__primary')).toBeNull();
  });

  it('stops searching at offers older than the order publication', async () => {
    await openWithPages(otherOffers(1, '2026-11-01T10:00:00.000Z'));

    expect(view.element('.offers__primary')).not.toBeNull();
  });

  it.each([1, 2])(
    'does not allow offering while the check fails on page %i, and recovers on retry',
    async (failingPage) => {
      await view.visit(`/trabajador/pedidos/${ORDER_ID}`);
      await view.answer('worker-profile/me/eligibility', ELIGIBLE);
      await view.answer(`orders/available/${ORDER_ID}`, workerOrder());
      if (failingPage === 2) {
        await view.answer('offers/me', otherOffers(1, '2026-11-20T10:00:00.000Z'));
      }
      await view.fail('offers/me', 500);

      expect(view.content()).toContain('No pudimos comprobar si ya ofertó');
      expect(view.element('.offers__primary')).toBeNull();

      await view.click('app-error-alert button');
      await view.answer('offers/me', page([]));
      expect(view.element('.offers__primary')).not.toBeNull();
    },
  );

  it('explains an order the worker cannot see', async () => {
    await view.visit(`/trabajador/pedidos/${ORDER_ID}`);
    await view.answer('worker-profile/me/eligibility', ELIGIBLE);
    await view.fail(`orders/available/${ORDER_ID}`, 404);

    expect(view.text('h1')).toBe('Pedido no disponible');
  });
});

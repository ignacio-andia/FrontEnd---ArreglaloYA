import { apiUrl } from '../../../core/http/api-url';
import { ORDER_ID, page, setupOfferPage } from '../../offers/testing/offers.fixtures';
import { stubObjectUrls } from '../../orders/testing/order.fixtures';
import { receipts } from '../../payments/testing/payments.fixtures';
import { event, timeline } from '../../workflow/testing/workflow.fixtures';
import { ADMIN_CLAIMS_ROUTES } from '../claims.routes';
import { ClaimSummary } from '../models/claim.model';
import { CLAIM_ID, claim } from '../testing/claims.fixtures';

const row = (overrides: Partial<ClaimSummary> = {}): ClaimSummary => ({
  id: CLAIM_ID,
  orderId: ORDER_ID,
  status: 'ABIERTO',
  imageCount: 2,
  createdAt: '2026-11-22T14:00:00.000Z',
  ...overrides,
});
const ADMIN_ORDER = {
  id: ORDER_ID,
  status: 'EN_RECLAMO',
  category: { id: 'c', name: 'Plomería' },
  zone: { id: 'z', name: 'Zona Norte' },
  budgetAmount: '120.00',
  publishedAt: '2026-11-20T10:00:00.000Z',
  client: { id: 'client', firstName: 'Clara', lastName: 'Cliente' },
  assignedWorkerId: 'worker-id',
};

describe('administration of claims', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  beforeEach(async () => {
    stubObjectUrls();
    view = await setupOfferPage(
      [{ path: 'admin/reclamos', children: ADMIN_CLAIMS_ROUTES }],
      'ADMINISTRADOR',
    );
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  const listRequest = () => view.request('GET', 'admin', 'claims');

  describe('list (#95)', () => {
    async function open(url = '/admin/reclamos', body: object = page([row()])) {
      await view.visit(url);
      const request = await listRequest();
      request.flush(body);
      await view.render();
      return request.request.params.toString();
    }

    it('asks the first page and shows the claims as the backend orders them', async () => {
      const params = await open(
        '/admin/reclamos',
        page([row(), row({ id: 'aaaaaaaa-0000', status: 'RESUELTO', imageCount: 0 })]),
      );

      expect(params).toBe('page=1&limit=20');
      const items = [...view.root().querySelectorAll('.claim-row')].map((item) =>
        item.textContent?.replace(/\s+/g, ' '),
      );
      expect(items[0]).toContain('Reclamo c1a1b2c3');
      expect(items[0]).toContain('Abierto');
      expect(items[0]).toContain('22/11/2026 10:00');
      expect(items[0]).toContain('Fotografías: 2');
      expect(items[1]).toContain('Resuelto');
      expect(view.element('.claim-row a')?.getAttribute('href')).toBe(
        `/admin/reclamos/${CLAIM_ID}`,
      );
    });

    it('shows loading, empty and the filtered empty state', async () => {
      await view.visit('/admin/reclamos');
      expect(view.content()).toContain('Cargando los reclamos');
      (await listRequest()).flush(page([]));
      await view.render();
      expect(view.content()).toContain('Todavía no hay reclamos.');

      await view.type('#claims-status', 'EN_REVISION');
      const filtered = await listRequest();
      expect(filtered.request.params.get('status')).toBe('EN_REVISION');
      filtered.flush(page([]));
      await view.render();
      expect(view.content()).toContain('No hay reclamos con ese estado.');
      expect(view.router.url).toContain('estado=EN_REVISION');
    });

    it('ignores unknown query values', async () => {
      expect(await open('/admin/reclamos?estado=OTRO&pagina=-2')).toBe('page=1&limit=20');
    });

    it('pages through the results', async () => {
      await open('/admin/reclamos', {
        data: [row()],
        meta: { page: 1, limit: 20, total: 21, totalPages: 2 },
      });
      const next = [...view.root().querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Siguiente',
      )!;
      next.click();
      await view.render();
      const request = await listRequest();
      expect(request.request.params.get('page')).toBe('2');
      request.flush({ data: [], meta: { page: 2, limit: 20, total: 20, totalPages: 1 } });
      await view.render();
      expect(view.content()).toContain('No hay reclamos en esta página.');
    });

    it.each([403, 500])('shows and retries a %i', async (status) => {
      await view.visit('/admin/reclamos');
      await view.fail('admin/claims', status, 'Fallo');
      await view.click('app-error-alert button');
      await view.answer('admin/claims', page([row()]));
      expect(view.content()).toContain('Reclamo c1a1b2c3');
    });
  });

  describe('detail (#96)', () => {
    async function photos(): Promise<void> {
      view.http
        .match((request) => request.url.includes('/images/'))
        .forEach((request) => request.flush(new Blob(['x'])));
      await view.render();
    }

    async function open(body = claim()): Promise<void> {
      await view.visit(`/admin/reclamos/${CLAIM_ID}`);
      await view.answer(`admin/claims/${CLAIM_ID}`, body);
      await view.answer(`orders/admin/${ORDER_ID}`, ADMIN_ORDER);
      await view.answer(`orders/${ORDER_ID}/receipts`, receipts());
      await view.answer(
        `orders/${ORDER_ID}/timeline`,
        timeline([event({ summary: 'Reclamo presentado' })]),
      );
      await photos();
    }

    it('shows the claim, the order with its parties, the receipts and the history', async () => {
      await open();

      const content = view.content();
      for (const text of [
        'Sigue goteando por la unión',
        'Fotografías del reclamo (2)',
        'Abierto',
        'Plomería',
        'Zona Norte',
        'Clara Cliente',
        'worker-id',
        'Constancia del servicio',
        'Reclamo presentado',
      ]) {
        expect(content).toContain(text);
      }
      // Nadie es «usted» para el administrador y nunca se consulta el flujo de las partes.
      expect(content).not.toContain('(usted)');
      view.http.expectNone(apiUrl('orders', ORDER_ID, 'workflow'));
    });

    it('keeps the claim visible when the context fails, and retries it', async () => {
      await view.visit(`/admin/reclamos/${CLAIM_ID}`);
      await view.answer(`admin/claims/${CLAIM_ID}`, claim({ images: [] }));
      await view.fail(`orders/admin/${ORDER_ID}`, 500, 'Sin pedido');
      await view.fail(`orders/${ORDER_ID}/receipts`, 500, 'Sin constancias');
      await view.fail(`orders/${ORDER_ID}/timeline`, 500, 'Sin historial');

      expect(view.content()).toContain('Sigue goteando');
      expect(view.root().querySelectorAll('app-error-alert')).toHaveLength(3);
    });

    it.each([404, 400])('says the claim does not exist on a %i', async (status) => {
      await view.visit(`/admin/reclamos/${CLAIM_ID}`);
      await view.fail(`admin/claims/${CLAIM_ID}`, status);

      expect(view.text('h1')).toBe('Reclamo no encontrado');
    });

    it.each([403, 500])('shows and retries a %i', async (status) => {
      await view.visit(`/admin/reclamos/${CLAIM_ID}`);
      await view.fail(`admin/claims/${CLAIM_ID}`, status, 'Fallo');
      await view.click('app-error-alert button');
      await view.answer(`admin/claims/${CLAIM_ID}`, claim({ images: [] }));
      await view.answer(`orders/admin/${ORDER_ID}`, ADMIN_ORDER);
      await view.answer(`orders/${ORDER_ID}/receipts`, receipts());
      await view.answer(`orders/${ORDER_ID}/timeline`, timeline());
      expect(view.content()).toContain('Sigue goteando');
    });
  });
});

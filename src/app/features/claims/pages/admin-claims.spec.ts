import { TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionStore } from '../../../core/auth/session.store';
import { apiUrl } from '../../../core/http/api-url';
import { ORDER_ID, page, setupOfferPage } from '../../offers/testing/offers.fixtures';
import { stubObjectUrls } from '../../orders/testing/order.fixtures';
import { receipts } from '../../payments/testing/payments.fixtures';
import { event, timeline } from '../../workflow/testing/workflow.fixtures';
import { ADMIN_CLAIMS_ROUTES } from '../claims.routes';
import { ClaimSummary } from '../models/claim.model';
import { CLAIM_ID, claim, resolved } from '../testing/claims.fixtures';

const row = (overrides: Partial<ClaimSummary> = {}): ClaimSummary => ({
  id: CLAIM_ID,
  orderId: ORDER_ID,
  status: 'ABIERTO',
  imageCount: 2,
  createdAt: '2026-11-22T14:00:00.000Z',
  priority: 'MEDIA',
  dueAt: '2026-11-25T14:00:00.000Z',
  assignedAt: null,
  assignee: null,
  overdue: false,
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
    // La lista de responsables se pide en el listado y en el detalle; no es parte de estas pruebas.
    view.http
      .match((request) => request.url === apiUrl('admin', 'claims', 'assignees'))
      .forEach((request) => request.flush([]));
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

  describe('review and decision (#97, #98)', () => {
    const REVIEW = apiUrl('admin', 'claims', CLAIM_ID, 'review');
    const DECIDE = apiUrl('admin', 'claims', CLAIM_ID, 'decision');
    const dialog = () => view.element('dialog[open]');
    const confirm = () => view.click('dialog[open] .dialog__confirm');
    const notice = () => view.element('#action-notice');
    const review = () => view.element<HTMLButtonElement>('.resolution__review');
    const submit = () => view.element<HTMLButtonElement>('.resolution__send');
    const bare = (overrides = {}) => claim({ images: [], ...overrides });

    async function context(summary = 'Historial actualizado'): Promise<void> {
      await view.answer(`orders/admin/${ORDER_ID}`, ADMIN_ORDER);
      await view.answer(`orders/${ORDER_ID}/receipts`, receipts());
      await view.answer(`orders/${ORDER_ID}/timeline`, timeline([event({ summary })]));
    }

    async function open(body = bare()): Promise<void> {
      await view.visit(`/admin/reclamos/${CLAIM_ID}`);
      await view.answer(`admin/claims/${CLAIM_ID}`, body);
      await context('Reclamo presentado');
    }

    async function startReview(): Promise<TestRequest> {
      await view.click('.resolution__review');
      await confirm();
      return view.http.expectOne(REVIEW);
    }

    async function fill(decision = '  Revisar la unión  ', justification = '  Hay fuga  ') {
      await view.type('#claim-decision', decision);
      await view.type('#claim-justification', justification);
      await view.click('.resolution__send');
    }

    async function decide(): Promise<TestRequest> {
      await fill();
      await confirm();
      return view.http.expectOne(DECIDE);
    }

    async function fail(request: TestRequest, status: number, message: string): Promise<void> {
      request.flush({ statusCode: status, message }, { status, statusText: 'Error' });
      await view.render();
    }

    async function reloaded(body = bare()): Promise<void> {
      await view.answer(`admin/claims/${CLAIM_ID}`, body);
      await context();
    }

    it('offers both actions on an open claim', async () => {
      await open();

      expect(review()).not.toBeNull();
      expect(submit()).not.toBeNull();
    });

    it('offers only the decision while in review', async () => {
      await open(bare({ status: 'EN_REVISION' }));

      expect(review()).toBeNull();
      expect(submit()).not.toBeNull();
    });

    it('offers no action on a resolved claim and shows its decision', async () => {
      await open(resolved({ images: [] }));

      expect(view.element('app-claim-resolution')).toBeNull();
      expect(view.content()).toContain('Las fotografías muestran la fuga.');
    });

    it('starts the review once, shows the new state and refreshes the context', async () => {
      await open();
      await view.click('.resolution__review');
      expect(dialog()?.textContent).toContain('«En revisión»');
      view.http.expectNone(REVIEW);
      await confirm();
      const request = view.http.expectOne(REVIEW);
      expect(request.request.body).toBeNull();
      await confirm();
      view.http.expectNone(REVIEW);

      request.flush(bare({ status: 'EN_REVISION' }));
      await view.render();
      await context();

      expect(view.content()).toContain('En revisión');
      expect(view.content()).toContain('Historial actualizado');
      expect(review()).toBeNull();
      expect(notice()?.textContent).toContain('Revisión iniciada');
      expect(document.activeElement).toBe(notice());
    });

    it.each([
      ['', 'Hay fuga', 'Escriba la decisión.', 'claim-decision'],
      ['Revisar', '   ', 'Escriba la justificación.', 'claim-justification'],
      ['a'.repeat(2001), 'x', 'Use como máximo 2000 caracteres.', 'claim-decision'],
      ['x', 'a'.repeat(2001), 'Use como máximo 2000 caracteres.', 'claim-justification'],
    ])('requires decision and justification', async (decision, justification, message, id) => {
      await open();
      await fill(decision, justification);

      expect(view.content()).toContain(message);
      expect(document.activeElement?.id).toBe(id);
      expect(dialog()).toBeNull();
    });

    it('warns before resolving, without promising effects, and may be dismissed', async () => {
      await open();
      await fill();

      const text = dialog()!.textContent!.replace(/\s+/g, ' ');
      expect(text).toContain('«Cerrado»');
      expect(text).toContain('no se puede modificar');
      expect(text).toContain('no aplica sanciones, devoluciones');
      await view.click('dialog[open] .dialog__cancel');
      view.http.expectNone(DECIDE);
    });

    it('resolves once and shows the decision and justification of the backend', async () => {
      await open();
      const request = await decide();
      expect(request.request.body).toEqual({
        decision: 'Revisar la unión',
        justification: 'Hay fuga',
      });
      await confirm();
      view.http.expectNone(DECIDE);

      request.flush(resolved({ images: [] }));
      await view.render();
      await context();

      expect(view.content()).toContain('Resuelto');
      expect(view.content()).toContain('El trabajador debe revisar la unión.');
      expect(view.element('app-claim-resolution')).toBeNull();
      expect(notice()?.textContent).toContain('El pedido quedó «Cerrado»');
      expect(document.activeElement).toBe(notice());
    });

    it('keeps the confirmed result when the following queries fail', async () => {
      await open();
      (await decide()).flush(resolved({ images: [] }));
      await view.render();
      await view.fail(`orders/admin/${ORDER_ID}`, 500);
      await view.fail(`orders/${ORDER_ID}/receipts`, 500);
      await view.fail(`orders/${ORDER_ID}/timeline`, 500);

      expect(notice()?.textContent).toContain('Reclamo resuelto');
      expect(view.content()).toContain('El trabajador debe revisar la unión.');
    });

    it.each([
      [409, 'El reclamo ya fue resuelto.', 'El reclamo ya fue resuelto.'],
      [409, 'El pedido ya no está en reclamo (estado CERRADO).', 'El reclamo cambió de estado'],
      [404, 'El reclamo no existe', 'El reclamo no existe'],
      [403, 'Forbidden resource', 'Forbidden resource'],
    ])('shows a %i of the decision and consults again', async (status, message, shown) => {
      await open();
      await fail(await decide(), status, message);

      expect(notice()?.textContent).toContain(shown);
      expect(view.content()).not.toContain('estado CERRADO');
      await reloaded();
      expect(notice()?.textContent).toContain(shown);
    });

    it('does not show the internal status of a review conflict', async () => {
      await open();
      await fail(
        await startReview(),
        409,
        'El reclamo no se puede poner en revisión desde EN_REVISION.',
      );

      expect(notice()?.textContent).toContain('El reclamo cambió de estado');
      await reloaded(bare({ status: 'EN_REVISION' }));
    });

    it.each([
      [400, 'decision es obligatoria', 'decision es obligatoria'],
      [500, 'boom', 'error en el servidor'],
    ])('keeps what was written after a %i', async (status, message, shown) => {
      await open();
      await fail(await decide(), status, message);

      expect(notice()?.textContent).toContain(shown);
      expect(view.element<HTMLTextAreaElement>('#claim-decision')?.value).toContain('Revisar');
      expect(submit()?.disabled).toBe(false);
    });

    it('closes the session on a 401', async () => {
      await open();
      await fail(await startReview(), 401, 'Unauthorized');

      expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
    });
  });
});

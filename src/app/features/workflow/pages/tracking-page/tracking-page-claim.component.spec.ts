import { TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { Claim } from '../../../claims/models/claim.model';
import { ORDER_ID, page, received, setupOfferPage } from '../../../offers/testing/offers.fixtures';
import { OrderStatus } from '../../../orders/models/order.model';
import { MY_ORDERS_ROUTES } from '../../../orders/orders.routes';
import { ownerOrder, photo, stubObjectUrls } from '../../../orders/testing/order.fixtures';
import {
  cancellationSummary,
  overview,
  receipts,
} from '../../../payments/testing/payments.fixtures';
import { Execution } from '../../models/workflow.model';
import { event, timeline, workflow } from '../../testing/workflow.fixtures';

const SUMMARY = `orders/${ORDER_ID}/cancellation-summary`;
const ACCEPTED = received({ status: 'ACEPTADA' });
const FINISHED: Execution = {
  orderId: ORDER_ID,
  startedAt: '2026-11-01T15:00:00.000Z',
  finishedAt: '2026-11-01T18:00:00.000Z',
  // Plazo ya vencido: decide el backend.
  conformityDeadline: '2026-11-08T18:00:00.000Z',
  conformedAt: null,
};
const CLAIM: Claim = {
  id: 'c1',
  orderId: ORDER_ID,
  status: 'ABIERTO',
  description: 'Sigue goteando',
  images: [],
  decision: null,
  justification: null,
  decidedAt: null,
  createdAt: '2026-11-02T10:00:00.000Z',
};

const WORKFLOW = `orders/${ORDER_ID}/workflow`;
const TIMELINE = `orders/${ORDER_ID}/timeline`;
const PAYMENTS = `orders/${ORDER_ID}/payments`;
const RECEIPTS = `orders/${ORDER_ID}/receipts`;
const CLAIMS = apiUrl('orders', ORDER_ID, 'claims');

describe('TrackingPageComponent: claim', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  beforeEach(async () => {
    stubObjectUrls();
    view = await setupOfferPage(
      [{ path: 'cliente/mis-pedidos', children: MY_ORDERS_ROUTES }],
      'CLIENTE',
    );
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  async function open(status: OrderStatus = 'TERMINADO'): Promise<void> {
    await view.visit(`/cliente/mis-pedidos/${ORDER_ID}/seguimiento`);
    await view.answer(WORKFLOW, workflow(status, { execution: FINISHED }));
    await view.answer(TIMELINE, timeline());
    await view.answer(`orders/me/${ORDER_ID}`, ownerOrder({ status }));
    await view.answer('offers/received', page([ACCEPTED]));
    await view.answer(PAYMENTS, overview({ orderStatus: status, payments: [] }));
    await view.answer(RECEIPTS, receipts());
    if (status === 'CANCELADO') {
      await view.answer(SUMMARY, cancellationSummary());
    }
    if (status === 'EN_RECLAMO' || status === 'CERRADO') {
      await view.fail(`orders/${ORDER_ID}/claim`, 404);
    }
    if (status !== 'CERRADO' && status !== 'CANCELADO' && status !== 'PUBLICADO') {
      await view.answer(`offers/received/${ACCEPTED.id}/whatsapp`, {
        available: false,
        contactRole: 'TRABAJADOR',
        url: null,
        reason: 'TELEFONO_NO_REGISTRADO',
      });
    }
  }

  async function claimed(): Promise<void> {
    await view.answer(WORKFLOW, workflow('EN_RECLAMO', { execution: FINISHED }));
    await view.answer(TIMELINE, timeline([event({ summary: 'Reclamo presentado' })]));
    await view.answer(PAYMENTS, overview({ orderStatus: 'EN_RECLAMO', payments: [] }));
    await view.answer(RECEIPTS, receipts());
    await view.answer(`orders/${ORDER_ID}/claim`, CLAIM);
  }

  const form = () => view.element('.claim__form');
  const description = () => view.element<HTMLTextAreaElement>('#claim-description');
  const dialog = () => view.element('dialog[open]');
  const confirm = () => view.click('dialog[open] .dialog__confirm');
  const notice = () => view.element('#action-notice');
  const sendButton = () => view.element<HTMLButtonElement>('.claim__send');

  async function attach(...files: File[]): Promise<void> {
    const input = view.element<HTMLInputElement>('app-claim-form input[type="file"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    input.dispatchEvent(new Event('change'));
    await view.render();
  }

  async function fill(text = '  Sigue goteando  ', files: File[] = []): Promise<void> {
    await view.click('.claim__open');
    await view.type('#claim-description', text);
    if (files.length > 0) {
      await attach(...files);
    }
    await view.click('.claim__send');
  }

  async function send(files: File[] = []): Promise<TestRequest> {
    await fill(undefined, files);
    await confirm();
    return view.http.expectOne(CLAIMS);
  }

  async function fail(request: TestRequest, status: number, message: string | string[]) {
    request.flush({ statusCode: status, message }, { status, statusText: 'Error' });
    await view.render();
  }

  it('is offered on a finished order, closed until requested, with the focus on the text', async () => {
    await open();

    expect(view.element('.claim__open')?.textContent).toContain('Presentar reclamo');
    expect(form()).toBeNull();
    await view.click('.claim__open');
    expect(form()).not.toBeNull();
    expect(document.activeElement?.id).toBe('claim-description');
  });

  it('keeps what was written when closed, and returns the focus', async () => {
    await open();
    await view.click('.claim__open');
    await view.type('#claim-description', 'Borrador');
    await view.click('.claim__cancel');

    expect(form()).toBeNull();
    expect(document.activeElement?.classList).toContain('claim__open');
    await view.click('.claim__open');
    expect(description()?.value).toBe('Borrador');
  });

  it.each([
    'ACORDADO',
    'EN_EJECUCION',
    'PRESUPUESTO_ADICIONAL_PENDIENTE',
    'EN_RECLAMO',
    'CERRADO',
    'CANCELADO',
  ] as const)('is not offered in %s', async (status) => {
    await open(status);

    expect(view.element('app-claim-form')).toBeNull();
  });

  it.each([
    ['   ', 'Describa el problema.'],
    ['a'.repeat(2001), 'Use como máximo 2000 caracteres.'],
  ])('validates the description', async (text, message) => {
    await open();
    await fill(text);

    expect(view.content()).toContain(message);
    expect(description()?.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement?.id).toBe('claim-description');
    expect(dialog()).toBeNull();
  });

  it('rejects a file that is not an allowed photo or is too large', async () => {
    await open();
    await view.click('.claim__open');
    await attach(
      photo('doc.pdf', 'application/pdf'),
      photo('grande.jpg', 'image/jpeg', 11 * 1024 * 1024),
    );

    expect(view.content()).toContain('Formato no permitido');
    expect(view.content()).toContain('supera el tamaño máximo');
    expect(view.content()).toContain('0 de 20 por subir');
  });

  it('admits at most 20 photos', async () => {
    await open();
    await view.click('.claim__open');
    await attach(...Array.from({ length: 21 }, (_, index) => photo(`f${index}.jpg`)));

    expect(view.content()).toContain('20 de 20');
    expect(view.content()).toContain('Se alcanzó el máximo de 20');
  });

  it('warns about the consequences and sends nothing when dismissed', async () => {
    await open();
    await fill();

    const text = dialog()!.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('«En reclamo»');
    expect(text).toContain('Fotografías adjuntas: 0');
    expect(text).toContain('ya no podrá confirmar su conformidad');
    expect(text).toContain('no garantiza devoluciones');
    await view.click('dialog[open] .dialog__cancel');
    view.http.expectNone(CLAIMS);
  });

  it('sends the multipart once and updates the state and the history', async () => {
    await open();
    const files = [photo('a.jpg'), photo('b.png', 'image/png', 4096)];
    const request = await send(files);

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.has('Content-Type')).toBe(false);
    const body = request.request.body as FormData;
    expect(body.get('description')).toBe('Sigue goteando');
    expect((body.getAll('images') as File[]).map((file) => file.name)).toEqual(['a.jpg', 'b.png']);
    await confirm();
    view.http.expectNone(CLAIMS);

    request.flush(CLAIM, { status: 201, statusText: 'Created' });
    await view.render();
    expect(sendButton()?.disabled).toBe(true);
    expect(view.element<HTMLButtonElement>('.conformity__confirm')?.disabled).toBe(true);
    await claimed();

    expect(view.content()).toContain('En reclamo');
    expect(view.element('app-claim-form')).toBeNull();
    expect(view.element('app-conformity-panel')).toBeNull();
    expect(notice()?.textContent).toContain('Reclamo presentado');
    expect(document.activeElement).toBe(notice());
  });

  it('keeps the confirmed result when the following query fails', async () => {
    await open();
    (await send()).flush(CLAIM);
    await view.render();
    await view.fail(WORKFLOW, 500, 'Fallo del servidor');
    await view.answer(TIMELINE, timeline());

    expect(notice()?.textContent).toContain('Reclamo presentado');
  });

  it.each([
    [400, 'Un archivo no es una fotografía válida.'],
    [413, 'La fotografía supera el tamaño máximo de 10 MB.'],
  ])('keeps the text and the photos after a %i', async (status, message) => {
    await open();
    await fail(await send([photo('a.jpg')]), status, message);

    expect(notice()?.textContent).toContain(message);
    expect(description()?.value).toBe('  Sigue goteando  ');
    expect(view.content()).toContain('1 de 20 por subir');
    expect(sendButton()?.disabled).toBe(false);
  });

  it.each([
    [403, 'Forbidden resource'],
    [404, 'El pedido no existe'],
    [409, 'El plazo de 7 días para presentar un reclamo ya venció.'],
  ])('shows a %i answer and consults again', async (status, message) => {
    await open();
    await fail(await send(), status, message);

    expect(notice()?.textContent).toContain(message);
    await claimed();
    expect(notice()?.textContent).toContain(message);
  });

  it('shows a server failure and allows retrying', async () => {
    await open();
    await fail(await send(), 500, 'boom');

    expect(notice()?.textContent).toContain('error en el servidor');
    expect(sendButton()?.disabled).toBe(false);
  });

  it('closes the session on a 401', async () => {
    await open();
    await fail(await send(), 401, 'Unauthorized');

    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
  });
});

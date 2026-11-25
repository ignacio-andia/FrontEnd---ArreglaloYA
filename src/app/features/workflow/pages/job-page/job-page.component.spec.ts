import { apiUrl } from '../../../../core/http/api-url';
import { ORDER_ID, offer, page, setupOfferPage } from '../../../offers/testing/offers.fixtures';
import { OrderStatus } from '../../../orders/models/order.model';
import { assignedOrder, event, timeline, workflow } from '../../testing/workflow.fixtures';
import { overview, receipts } from '../../../payments/testing/payments.fixtures';
import { ASSIGNED_JOBS_ROUTES } from '../../workflow.routes';

const ACCEPTED = offer({ status: 'ACEPTADA' });
const CONTACT = {
  available: true,
  channel: 'WHATSAPP',
  contactRole: 'CLIENTE',
  url: 'https://wa.me/59170000000',
};

describe('JobPageComponent', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  beforeEach(async () => {
    view = await setupOfferPage(
      [{ path: 'trabajador/trabajos', children: ASSIGNED_JOBS_ROUTES }],
      'TRABAJADOR',
    );
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  const timelinePath = `orders/${ORDER_ID}/timeline`;

  /** La sección de pagos consulta el resumen y las constancias. */
  async function payments(): Promise<void> {
    await view.answer(`orders/${ORDER_ID}/payments`, overview({ payments: [] }));
    await view.answer(`orders/${ORDER_ID}/receipts`, receipts());
  }

  async function open(status: OrderStatus, history = timeline()): Promise<void> {
    await view.visit(`/trabajador/trabajos/${ORDER_ID}`);
    await view.answer(`orders/${ORDER_ID}/workflow`, workflow(status));
    await view.answer(timelinePath, history);
    await view.answer('offers/me', page([ACCEPTED]));
    await payments();
  }

  const entries = () =>
    [...view.root().querySelectorAll('.line__item')].map((item) =>
      item.textContent?.replace(/\s+/g, ' '),
    );

  it('shows state, agreement, authorized order data, contact and history', async () => {
    await open('EN_EJECUCION');
    await view.answer(`offers/me/${ACCEPTED.id}/whatsapp`, CONTACT);
    await view.answer(`orders/assigned/${ORDER_ID}`, assignedOrder('EN_EJECUCION'));

    const content = view.content();
    expect(content).toContain('En ejecución');
    expect(content).toContain('Monto de la oferta aceptada');
    expect(content).toContain('Bs 180.00');
    expect(content).toContain('Plomería');
    expect(content).toContain('Norte');
    expect(content).toContain('Ana Pérez');
    expect(content).toContain('Av. Ejemplo 123');
    expect(view.element('.contact__link')?.getAttribute('href')).toBe(CONTACT.url);
    expect(entries()).toHaveLength(1);
    // Todavía no hay acciones del trabajo.
    expect(content).not.toContain('Iniciar trabajo');
  });

  it.each(['CERRADO', 'CANCELADO'] as const)(
    'keeps the history of a %s job without private data or contact',
    async (status) => {
      await open(status);

      expect(view.content()).toContain('Sin acuerdo vigente');
      expect(view.content()).toContain('Historial del servicio');
      expect(view.element('app-assigned-order')).toBeNull();
      expect(view.element('app-whatsapp-contact')).toBeNull();
    },
  );

  it('keeps the allowed information when the backend refuses the private data', async () => {
    await open('ACORDADO');
    await view.fail(`offers/me/${ACCEPTED.id}/whatsapp`, 403, 'Perfil no aprobado');
    await view.fail(`orders/assigned/${ORDER_ID}`, 403, 'Perfil no aprobado');

    expect(view.content()).toContain('Perfil no aprobado');
    expect(view.content()).toContain('Bs 180.00');
    expect(entries()).toHaveLength(1);
  });

  it('shows the facts of the workflow', async () => {
    await view.visit(`/trabajador/trabajos/${ORDER_ID}`);
    await view.answer(
      `orders/${ORDER_ID}/workflow`,
      workflow('CERRADO', {
        visit: { orderId: ORDER_ID, performedAt: '2026-11-21T14:00:00.000Z', visitCost: '0.00' },
        execution: {
          orderId: ORDER_ID,
          startedAt: '2026-11-21T15:00:00.000Z',
          finishedAt: '2026-11-21T18:00:00.000Z',
          conformityDeadline: '2026-11-28T18:00:00.000Z',
          conformedAt: null,
        },
        additionalBudgets: [
          {
            id: 'b1',
            orderId: ORDER_ID,
            amount: '40.00',
            reason: 'Otra pieza',
            materials: 'Llave',
            status: 'RECHAZADO',
            respondedAt: '2026-11-21T16:00:00.000Z',
            createdAt: '2026-11-21T15:30:00.000Z',
          },
        ],
        noShowReport: {
          id: 'n1',
          orderId: ORDER_ID,
          description: 'No llegó',
          reportedAt: '2026-11-21T13:00:00.000Z',
        },
      }),
    );
    await view.answer(timelinePath, timeline([]));
    await view.answer('offers/me', page([ACCEPTED]));
    await payments();

    const content = view.content();
    expect(content).toContain('Gratis');
    expect(content).toContain('28/11/2026 14:00');
    expect(content).toContain('Bs 40.00 · Rechazado');
    expect(content).toContain('No llegó');
    expect(content).toContain('Todavía no hay acontecimientos registrados');
  });

  it('appends the following page with the cursor and hides the button at the end', async () => {
    await open('CERRADO', timeline([event()], 'cursor-1'));

    await view.click('.line__more');
    const request = await view.request('GET', 'orders', ORDER_ID, 'timeline');
    expect(request.request.params.get('cursor')).toBe('cursor-1');
    // Mientras carga no se repite la petición.
    await view.click('.line__more');
    view.http.expectNone((pending) => pending.url.endsWith('/timeline'));

    request.flush(
      timeline([
        event(),
        event({
          id: 'e2',
          summary: 'Trabajo terminado',
          at: '2026-11-21T14:00:00.000Z',
          actor: { type: 'USUARIO', userId: 'worker', role: 'TRABAJADOR' },
          details: { toStatus: 'TERMINADO' },
        }),
      ]),
    );
    await view.render();

    expect(entries()).toHaveLength(2);
    expect(entries()[1]).toContain('Trabajo terminado');
    expect(entries()[1]).toContain('Trabajador (usted)');
    expect(entries()[1]).toContain('Estado: Terminado');
    expect(view.element('.line__more')).toBeNull();
    // El foco pasa al primer acontecimiento nuevo.
    expect(document.activeElement?.textContent).toContain('Trabajo terminado');
  });

  it('keeps what was loaded when a following page fails, and retries it', async () => {
    await open('CERRADO', timeline([event()], 'cursor-1'));
    await view.click('.line__more');
    await view.fail(timelinePath, 500, 'Fallo del servidor');

    expect(entries()).toHaveLength(1);
    expect(view.content()).toContain('Ocurrió un error en el servidor');
    await view.click('app-service-timeline app-error-alert button');
    await view.answer(timelinePath, timeline([event({ id: 'e2' })]));
    expect(entries()).toHaveLength(2);
  });

  it.each([403, 404, 409])('reloads everything when loading more answers %i', async (code) => {
    await open('CERRADO', timeline([event()], 'cursor-1'));
    await view.click('.line__more');
    await view.fail(timelinePath, code);

    await view.answer(`orders/${ORDER_ID}/workflow`, workflow('CANCELADO'));
    await view.answer(timelinePath, timeline([event({ summary: 'Trabajo cancelado' })]));
    await payments();
    expect(view.content()).toContain('Cancelado');
    expect(entries()[0]).toContain('Trabajo cancelado');
  });

  it('retries a history that failed without hiding the state', async () => {
    await view.visit(`/trabajador/trabajos/${ORDER_ID}`);
    await view.answer(`orders/${ORDER_ID}/workflow`, workflow('CERRADO'));
    await view.fail(timelinePath, 500, 'Sin historial');
    await view.answer('offers/me', page([ACCEPTED]));
    await payments();

    expect(view.content()).toContain('Estado del servicio');
    await view.click('app-service-history app-error-alert button');
    await view.answer(`orders/${ORDER_ID}/workflow`, workflow('CERRADO'));
    await view.answer(timelinePath, timeline());
    await payments();
    expect(entries()).toHaveLength(1);
  });

  it('hides a job of another worker', async () => {
    await view.visit(`/trabajador/trabajos/${ORDER_ID}`);
    await view.fail(`orders/${ORDER_ID}/workflow`, 404);
    view.http
      .expectOne((request) => request.url === apiUrl('orders', ORDER_ID, 'timeline'))
      .flush({ statusCode: 404 }, { status: 404, statusText: 'Not Found' });
    await view.render();

    expect(view.text('h1')).toBe('Trabajo no encontrado');
    expect(view.element('app-service-history')).toBeNull();
  });

  it('retries after a failure of the workflow', async () => {
    await view.visit(`/trabajador/trabajos/${ORDER_ID}`);
    await view.fail(`orders/${ORDER_ID}/workflow`, 500, 'Fallo del servidor');
    await view.answer(timelinePath, timeline());

    await view.click('app-error-alert button');
    await view.answer(`orders/${ORDER_ID}/workflow`, workflow('CERRADO'));
    await view.answer(timelinePath, timeline());
    await view.answer('offers/me', page([ACCEPTED]));
    await payments();
    expect(view.content()).toContain('Cerrado');
  });
});

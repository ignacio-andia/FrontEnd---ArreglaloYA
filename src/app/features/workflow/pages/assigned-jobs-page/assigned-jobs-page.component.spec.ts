import { apiUrl } from '../../../../core/http/api-url';
import { offer, page, setupOfferPage } from '../../../offers/testing/offers.fixtures';
import { OrderStatus } from '../../../orders/models/order.model';
import { assignedOrder, workflow } from '../../testing/workflow.fixtures';
import { ASSIGNED_JOBS_ROUTES } from '../../workflow.routes';

/** Oferta aceptada del pedido `order-N`. */
function job(index: number) {
  return offer({
    id: `offer-${index}`,
    orderId: `order-${index}`,
    status: 'ACEPTADA',
    closedAt: '2026-11-20T15:00:00.000Z',
  });
}

describe('AssignedJobsPageComponent', () => {
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

  async function open(url = '/trabajador/trabajos') {
    await view.visit(url);
    return view.request('GET', 'offers', 'me');
  }

  async function status(index: number, value: OrderStatus): Promise<void> {
    await view.answer(`orders/order-${index}/workflow`, workflow(value));
  }

  const cards = () => [...view.root().querySelectorAll('.job')];
  const cardText = (index: number) => cards()[index].textContent?.replace(/\s+/g, ' ') ?? '';

  it('lists the accepted offers page by page while loading', async () => {
    const request = await open();
    expect(request.request.params.toString()).toBe('status=ACEPTADA&page=1&limit=12');
    expect(view.content()).toContain('Cargando sus trabajos');

    request.flush(page([job(1)]));
    await view.render();
    expect(cardText(0)).toContain('Consultando el trabajo');

    await status(1, 'EN_EJECUCION');
    await view.answer('orders/assigned/order-1', assignedOrder('EN_EJECUCION'));

    expect(cardText(0)).toContain('Plomería · Norte');
    expect(cardText(0)).toContain('Cliente: Ana Pérez');
    expect(cardText(0)).toContain('En ejecución');
    expect(cardText(0)).toContain('Bs 180.00');
    expect(view.element('.job__link')?.getAttribute('href')).toBe('/trabajador/trabajos/order-1');
    // La dirección es del detalle, no del listado.
    expect(view.content()).not.toContain('Av. Ejemplo');
  });

  it('keeps closed and cancelled jobs without asking for private data', async () => {
    (await open()).flush(page([job(1), job(2), job(3)]));
    await view.render();
    await status(1, 'CERRADO');
    await status(2, 'CANCELADO');
    await status(3, 'TERMINADO');
    await view.answer('orders/assigned/order-3', assignedOrder('TERMINADO'));

    expect(cardText(0)).toContain('Cerrado');
    expect(cardText(0)).toContain('Sin acuerdo vigente');
    expect(cardText(1)).toContain('Cancelado');
    expect(cardText(2)).toContain('Terminado');
    expect(cardText(2)).toContain('Cliente: Ana Pérez');
  });

  it('shows only the permitted data to a worker without approval', async () => {
    (await open()).flush(page([job(1)]));
    await view.render();
    await status(1, 'ACORDADO');
    await view.fail('orders/assigned/order-1', 403);

    expect(cardText(0)).toContain('Acordado');
    expect(cardText(0)).toContain('no están disponibles para su cuenta');
    expect(cardText(0)).toContain('Bs 180.00');
    expect(cardText(0)).not.toContain('Cliente:');
  });

  it('isolates the error of a card and retries only that one', async () => {
    (await open()).flush(page([job(1), job(2)]));
    await view.render();
    await view.fail('orders/order-1/workflow', 500, 'Fallo del servidor');
    await status(2, 'CERRADO');

    expect(cardText(0)).toContain('Ocurrió un error en el servidor');
    expect(cardText(1)).toContain('Cerrado');

    await view.click('.job__retry button');
    await status(1, 'CANCELADO');
    expect(cardText(0)).toContain('Cancelado');
    expect(cardText(1)).toContain('Cerrado');
  });

  it('never asks more than four cards at the same time', async () => {
    const jobs = Array.from({ length: 12 }, (_, index) => job(index + 1));
    (await open()).flush(page(jobs));
    await view.render();

    const pending = () => view.http.match((request) => request.url.includes('/orders/'));
    let total = 0;
    for (let batch = pending(); batch.length > 0; batch = pending()) {
      expect(batch.length).toBeLessThanOrEqual(4);
      total += batch.length;
      batch.forEach((request) => {
        const assigned = request.request.url.includes('/assigned/');
        request.flush(assigned ? assignedOrder() : workflow('ACORDADO'));
      });
      await view.render();
    }

    expect(total).toBe(24);
  });

  it('paginates keeping the page in the URL', async () => {
    (await open()).flush(page([job(1)], 30));
    await view.render();
    await status(1, 'CERRADO');

    [...view.root().querySelectorAll<HTMLButtonElement>('app-paginator button')].at(-1)?.click();
    await view.render();
    const second = await view.request('GET', 'offers', 'me');
    expect(second.request.params.get('page')).toBe('2');
    expect(view.router.url).toBe('/trabajador/trabajos?pagina=2');
    second.flush(page([], 30));
    await view.render();
    expect(view.content()).toContain('No hay trabajos en esta página');
  });

  it('explains an empty list', async () => {
    (await open()).flush(page([]));
    await view.render();

    expect(view.content()).toContain('Todavía no tiene trabajos asignados');
  });

  it('shows the list error with a retry', async () => {
    await view.visit('/trabajador/trabajos');
    await view.fail('offers/me', 500, 'Fallo del servidor');
    expect(view.content()).toContain('Ocurrió un error en el servidor');

    await view.click('app-error-alert button');
    view.http.expectOne((request) => request.url === apiUrl('offers', 'me')).flush(page([]));
    await view.render();
  });
});

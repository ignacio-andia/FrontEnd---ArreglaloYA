import { AVAILABLE_ORDERS_ROUTES, OWN_OFFERS_ROUTES } from '../../offers.routes';
import {
  OFFER_ID,
  ORDER_ID,
  detail,
  setupOfferPage,
  workerOrder,
} from '../../testing/offers.fixtures';

const ELIGIBLE = {
  eligible: true,
  canTakeNewWork: true,
  status: 'APROBADO',
  message: 'Perfil aprobado',
  reason: null,
  pendingZoneChangeRequest: null,
};

describe('CreateOfferPageComponent', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  beforeEach(async () => {
    view = await setupOfferPage(
      [
        { path: 'trabajador/pedidos', children: AVAILABLE_ORDERS_ROUTES },
        { path: 'trabajador/ofertas', children: OWN_OFFERS_ROUTES },
      ],
      'TRABAJADOR',
    );
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  async function open(canTakeNewWork = true): Promise<void> {
    await view.visit(`/trabajador/pedidos/${ORDER_ID}/ofertar`);
    // El guard de la ruta consulta la elegibilidad antes de activar la página.
    await view.answer('worker-profile/me/eligibility', ELIGIBLE);
    await view.answer(`orders/available/${ORDER_ID}`, workerOrder());
    await view.answer('worker-profile/me/eligibility', { ...ELIGIBLE, canTakeNewWork });
  }

  async function fill(start = '2099-01-15T10:30'): Promise<void> {
    await view.type('#offer-amount', '180,5');
    await radio('requiresVisit', 1);
    await view.type('#offer-visitCost', '0');
    await radio('materialsIncluded', 0);
    await view.type('#offer-proposedStartAt', start);
    await view.type('#offer-estimatedDurationMinutes', '90');
  }

  async function radio(name: string, index: number): Promise<void> {
    view.root().querySelectorAll<HTMLInputElement>(`[formcontrolname="${name}"]`)[index].click();
    await view.render();
  }

  async function submit(): Promise<void> {
    await view.click('form button[type="submit"]');
  }

  const send = () => view.click('.offers__actions .offers__primary');

  it('asks for every required field', async () => {
    await open();
    await submit();

    const content = view.content();
    expect(content).toContain('Indique el monto de su oferta');
    expect(content).toContain('Elija la modalidad');
    expect(content).toContain('Indique si incluye los materiales');
    expect(content).toContain('Indique la fecha y la hora de inicio');
    expect(content).toContain('Indique la duración estimada');
    expect(view.element('#offer-visitCost')).toBeNull();
  });

  it('rejects a past date and invalid numbers', async () => {
    await open();
    await fill('2020-01-15T10:30');
    await view.type('#offer-amount', '0');
    await view.type('#offer-estimatedDurationMinutes', '0');
    await submit();

    const content = view.content();
    expect(content).toContain('deben ser futuras');
    expect(content).toContain('Ingrese un monto mayor que 0');
    expect(content).toContain('número entero de minutos');
  });

  it('reviews the data and sends the date with the Bolivian time zone', async () => {
    await open();
    await fill();
    await submit();

    expect(view.content()).toContain('Revise su oferta');
    expect(view.content()).toContain('15/01/2099 10:30 (hora de Bolivia)');
    view.http.expectNone((request) => request.method === 'POST');

    await send();
    const request = await view.request('POST', 'offers', 'orders', ORDER_ID);
    expect(request.request.body).toEqual({
      amount: '180.5',
      requiresVisit: true,
      visitCost: '0',
      materialsIncluded: true,
      proposedStartAt: '2099-01-15T10:30:00-04:00',
      estimatedDurationMinutes: 90,
    });

    // Un segundo clic no repite el envío.
    await send();
    view.http.expectNone((pending) => pending.method === 'POST');

    request.flush(detail());
    await view.render();
    await vi.waitFor(() => expect(view.router.url).toBe(`/trabajador/ofertas/${OFFER_ID}`));

    await view.answer(`offers/me/${OFFER_ID}`, detail());
    await view.answer(`offers/me/${OFFER_ID}/whatsapp`, {
      available: false,
      channel: 'WHATSAPP',
      contactRole: 'CLIENTE',
      url: null,
      reason: 'TELEFONO_INVALIDO',
    });
    await view.answer(`orders/available/${ORDER_ID}`, workerOrder());
    expect(view.content()).toContain('Su oferta fue enviada');
  });

  it('goes back from the review keeping the values', async () => {
    await open();
    await fill();
    await submit();
    await view.click('.offers__actions .offers__secondary');

    expect(view.element<HTMLInputElement>('#offer-amount')?.value).toBe('180,5');
  });

  it('shows why the backend refuses a duplicated offer', async () => {
    await open();
    await fill();
    await submit();
    await send();
    await view.fail(`offers/orders/${ORDER_ID}`, 409, 'Ya ofertó en este pedido', 'POST');

    expect(view.text('#offer-error-summary')).toContain('Ya ofertó en este pedido');
  });

  it('returns to the form with the server validation errors', async () => {
    await open();
    await fill();
    await submit();
    await send();
    await view.fail(
      `offers/orders/${ORDER_ID}`,
      400,
      ['proposedStartAt debe ser una fecha futura'],
      'POST',
    );

    expect(view.element('#offer-amount')).not.toBeNull();
    expect(view.element('#offer-proposedStartAt')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('blocks sending while the worker cannot take new work', async () => {
    await open(false);

    expect(view.content()).toContain('no puede ofertar trabajos nuevos');
    expect(view.element<HTMLButtonElement>('form button[type="submit"]')?.disabled).toBe(true);
  });

  it('explains an order that is not available', async () => {
    await view.visit(`/trabajador/pedidos/${ORDER_ID}/ofertar`);
    await view.answer('worker-profile/me/eligibility', ELIGIBLE);
    await view.fail(`orders/available/${ORDER_ID}`, 404);
    await view.answer('worker-profile/me/eligibility', ELIGIBLE);

    expect(view.content()).toContain('no está disponible para ofertar');
    expect(view.element('form')).toBeNull();
  });
});

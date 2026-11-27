import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { OwnerOrder } from '../../models/order.model';
import { MY_ORDERS_ROUTES } from '../../orders.routes';
import { ownerOrder } from '../../testing/order.fixtures';
import { OrderDetailPageComponent } from './order-detail-page.component';

const ORDER = ownerOrder({ images: [] });
const URL_DETAIL = apiUrl('orders', 'me', ORDER.id);
const URL_CANCEL = apiUrl('orders', 'me', ORDER.id, 'cancel');
const CANCELLED = ownerOrder({
  status: 'CANCELADO',
  canEdit: false,
  canCancel: false,
  images: [],
  address: null,
  cancelledAt: '2026-11-16T10:00:00.000Z',
  anonymizedAt: '2026-11-16T10:00:00.000Z',
});

describe('OrderDetailPageComponent (acciones)', () => {
  let harness: RouterTestingHarness;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'cliente/mis-pedidos', children: MY_ORDERS_ROUTES }]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => httpTesting.verify());

  const element = () => harness.routeNativeElement as HTMLElement;
  const text = () => element().textContent?.replace(/\s+/g, ' ') ?? '';

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
  }

  async function open(order: OwnerOrder = ORDER): Promise<void> {
    const navigation = harness.navigateByUrl(
      `/cliente/mis-pedidos/${order.id}`,
      OrderDetailPageComponent,
    );
    (await vi.waitFor(() => httpTesting.expectOne(URL_DETAIL))).flush(order);
    if (order.status === 'ACORDADO' || order.status === 'EN_EJECUCION') {
      await flushAssignedOffer();
    }
    await navigation;
    await settle();
  }

  /** Con acuerdo, el detalle consulta la oferta aceptada para mostrar al asignado. */
  async function flushAssignedOffer(): Promise<void> {
    const request = await vi.waitFor(() => {
      harness.detectChanges();
      return httpTesting.expectOne((req) => req.url === apiUrl('offers', 'received'));
    });
    request.flush({ data: [], meta: { page: 1, limit: 1, total: 0, totalPages: 0 } });
    await settle();
  }

  function click(selector: string): void {
    element().querySelector<HTMLButtonElement>(selector)?.click();
    harness.detectChanges();
  }

  const editLink = () => element().querySelector('a[href$="/editar"]');
  const cancelButton = () => element().querySelector<HTMLButtonElement>('.cancel__button');
  const field = () => element().querySelector<HTMLTextAreaElement>('#cancel-order-reason')!;
  const fieldHelp = () => element().querySelector('#cancel-order-reason-hint')?.textContent;
  const dialogOpen = () => element().querySelector('dialog')?.hasAttribute('open');

  function type(value: string): void {
    field().value = value;
    field().dispatchEvent(new Event('input'));
    harness.detectChanges();
  }

  /** Abre la confirmación, escribe el motivo y confirma. */
  function send(reason = 'Ya lo resolví'): void {
    click('.cancel__button');
    type(reason);
    click('.dialog__confirm');
  }

  async function fail(status: number, message: string | string[]): Promise<void> {
    httpTesting
      .expectOne(URL_CANCEL)
      .flush({ statusCode: status, message }, { status, statusText: 'Error' });
    await settle();
  }

  it('offers to edit and cancel only when the backend allows it', async () => {
    await open();

    expect(editLink()).not.toBeNull();
    expect(cancelButton()).not.toBeNull();
    expect(text()).toContain('Vence el');
  });

  it('shows an expired order as such, without actions', async () => {
    await open(ownerOrder({ status: 'VENCIDO', canEdit: false, canCancel: false, images: [] }));

    expect(editLink()).toBeNull();
    expect(cancelButton()).toBeNull();
    expect(text()).toContain('Venció el');
    expect(text()).toContain('Se cumplió el plazo de 7 días');
  });

  it.each(['ACORDADO', 'EN_EJECUCION'] as const)(
    'explains that a %s order is cancelled as agreed work',
    async (status) => {
      await open(ownerOrder({ status, canEdit: false, canCancel: false, images: [] }));

      expect(cancelButton()).toBeNull();
      expect(text()).toContain('«Cancelar trabajo»');
      expect(text()).not.toContain('Vence el');
    },
  );

  it('does not mention agreed work for a closed order', async () => {
    await open(CANCELLED);

    expect(text()).not.toContain('Cancelar trabajo');
  });

  it('asks for confirmation and sends nothing when dismissed', async () => {
    await open();
    click('.cancel__button');
    expect(element().querySelector('dialog')?.hasAttribute('open')).toBe(true);

    click('.dialog__cancel');

    httpTesting.expectNone(URL_CANCEL);
    expect(element().querySelector('dialog')?.hasAttribute('open')).toBe(false);
  });

  it.each([
    ['', 'Indique el motivo.'],
    ['   ', 'Indique el motivo.'],
    ['a'.repeat(501), 'Máximo 500 caracteres.'],
  ])('does not send the reason «%s»', async (reason, message) => {
    await open();
    send(reason);
    await settle();

    httpTesting.expectNone(URL_CANCEL);
    expect(dialogOpen()).toBe(true);
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(fieldHelp()).toContain(message);
    expect(document.activeElement).toBe(field());
  });

  it('counts the trimmed characters and admits exactly 500', async () => {
    await open();
    click('.cancel__button');
    type(`  ${'a'.repeat(500)}  `);
    expect(fieldHelp()).toContain('500 / 500');
    expect(field().getAttribute('aria-invalid')).toBeNull();

    click('.dialog__confirm');
    const request = httpTesting.expectOne(URL_CANCEL);
    expect(request.request.body).toEqual({ reason: 'a'.repeat(500) });
    request.flush(CANCELLED);
    await settle();
  });

  it('cancels with the trimmed reason, once, and shows the returned order', async () => {
    await open();
    send('  Ya lo resolví  ');
    click('.dialog__confirm');

    const request = httpTesting.expectOne(URL_CANCEL);
    expect(request.request.body).toEqual({ reason: 'Ya lo resolví' });
    request.flush(CANCELLED);
    await settle();

    expect(text()).toContain('El pedido fue cancelado.');
    expect(text()).toContain('Cancelado');
    expect(cancelButton()).toBeNull();
  });

  it('drops the cancellation notice when another order is opened', async () => {
    await open();
    send();
    httpTesting.expectOne(URL_CANCEL).flush(CANCELLED);
    await settle();
    expect(text()).toContain('El pedido fue cancelado.');

    const other = ownerOrder({ id: '00000000-0000-4000-8000-000000000009', images: [] });
    const navigation = harness.navigateByUrl(`/cliente/mis-pedidos/${other.id}`);
    (await vi.waitFor(() => httpTesting.expectOne(apiUrl('orders', 'me', other.id)))).flush(other);
    await navigation;
    await settle();

    expect(text()).not.toContain('El pedido fue cancelado.');
  });

  it('keeps the confirmation open when the backend rejects the reason', async () => {
    await open();
    send();
    await fail(400, ['reason must be a string', 'reason es obligatorio']);

    expect(dialogOpen()).toBe(true);
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(fieldHelp()).toContain('El servidor rechazó este dato');
    expect(text()).not.toContain('reason must be');
    expect(document.activeElement).toBe(field());
  });

  it('does not show a 400 that is not about the reason as it arrives', async () => {
    await open();
    send();
    await fail(400, 'Validation failed (uuid is expected)');

    expect(dialogOpen()).toBe(false);
    expect(text()).toContain('No se pudo cancelar el pedido.');
    expect(text()).not.toContain('Validation failed');
  });

  it('shows the 409 message and refreshes the order', async () => {
    const message =
      'El pedido ya tiene un acuerdo: no se puede cancelar por esta vía. Use «Cancelar trabajo» (RF-34).';
    await open();
    send();
    await fail(409, message);
    (await vi.waitFor(() => httpTesting.expectOne(URL_DETAIL))).flush(
      ownerOrder({ status: 'ACORDADO', canEdit: false, canCancel: false, images: [] }),
    );
    await flushAssignedOffer();

    expect(element().querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(cancelButton()).toBeNull();
  });

  it('does not show the internal status name of a conflict', async () => {
    await open();
    send();
    await fail(409, 'No se puede cancelar un pedido en estado CANCELADO');
    (await vi.waitFor(() => httpTesting.expectOne(URL_DETAIL))).flush(CANCELLED);
    await settle();

    expect(text()).toContain('El pedido cambió de estado.');
    expect(text()).not.toContain('en estado CANCELADO');
  });

  it('reports an expired order and refreshes it', async () => {
    await open();
    send();
    await fail(409, 'El pedido venció y ya no se puede cancelar.');
    (await vi.waitFor(() => httpTesting.expectOne(URL_DETAIL))).flush(
      ownerOrder({ status: 'VENCIDO', canEdit: false, canCancel: false, images: [] }),
    );
    await settle();

    expect(text()).toContain('El pedido venció y ya no se puede cancelar.');
    expect(cancelButton()).toBeNull();
  });

  it.each([403, 404])('shows a %i answer and consults the order again', async (status) => {
    await open();
    send();
    await fail(status, 'Respuesta del backend');
    (await vi.waitFor(() => httpTesting.expectOne(URL_DETAIL))).flush(ORDER);
    await settle();

    expect(text()).toContain('Respuesta del backend');
  });

  it.each([500, 0])('after a %i consults the order before allowing a retry', async (status) => {
    await open();
    send();
    await fail(status, 'boom');

    const query = await vi.waitFor(() => httpTesting.expectOne(URL_DETAIL));
    harness.detectChanges();
    expect(cancelButton()?.disabled).toBe(true);
    expect(text()).toContain('No pudimos confirmar si se realizó la cancelación.');

    query.flush(ORDER);
    await settle();
    expect(cancelButton()?.disabled).toBe(false);
    httpTesting.expectNone(URL_CANCEL);
  });

  describe('when the result of the cancellation is unknown', () => {
    const UNKNOWN = 'No pudimos confirmar si se realizó la cancelación.';
    const NOT_REGISTERED = 'Verificamos el pedido: no consta como cancelado.';
    const alerts = () => element().querySelectorAll('[role="alert"]');
    const actionAlert = () => element().querySelector('#order-action-error');
    const occurrences = (fragment: string) => text().split(fragment).length - 1;

    /** Pierde la conexión al cancelar y devuelve la consulta posterior, aún sin responder. */
    async function lose(status = 0) {
      await open();
      send();
      await fail(status, 'boom');
      return vi.waitFor(() => httpTesting.expectOne(URL_DETAIL));
    }

    async function reload(order: OwnerOrder): Promise<void> {
      click('.detail__alert button');
      (await vi.waitFor(() => httpTesting.expectOne(URL_DETAIL))).flush(order);
      await settle();
    }

    it.each([500, 0])(
      'after a %i keeps the warning if the order cannot be loaded',
      async (code) => {
        (await lose(code)).error(new ProgressEvent('error'));
        await settle();

        expect(actionAlert()?.textContent).toContain(UNKNOWN);
        expect(actionAlert()?.textContent).toContain('antes de volver a intentarlo');
        expect(occurrences(UNKNOWN)).toBe(1);
        expect(text()).toContain('No se pudo cargar el pedido.');
        expect(document.activeElement).toBe(actionAlert());
        // Sin el pedido verificado no hay forma de volver a cancelar.
        expect(cancelButton()).toBeNull();
        httpTesting.expectNone(URL_CANCEL);
      },
    );

    it('keeps it while retrying and allows a new attempt only with the order loaded', async () => {
      (await lose()).error(new ProgressEvent('error'));
      await settle();

      click('.detail__alert button');
      const query = await vi.waitFor(() => httpTesting.expectOne(URL_DETAIL));
      harness.detectChanges();
      expect(actionAlert()?.textContent).toContain(UNKNOWN);
      expect(cancelButton()).toBeNull();

      query.flush(ORDER);
      await settle();
      expect(text()).not.toContain(UNKNOWN);
      expect(occurrences(NOT_REGISTERED)).toBe(1);
      expect(document.activeElement).toBe(actionAlert());
      expect(cancelButton()?.disabled).toBe(false);
    });

    it('keeps the warning through every query that fails', async () => {
      (await lose()).error(new ProgressEvent('error'));
      await settle();

      for (let attempt = 0; attempt < 2; attempt += 1) {
        click('.detail__alert button');
        (await vi.waitFor(() => httpTesting.expectOne(URL_DETAIL))).error(
          new ProgressEvent('error'),
        );
        await settle();

        expect(occurrences(UNKNOWN)).toBe(1);
        expect(text()).not.toContain(NOT_REGISTERED);
        expect(cancelButton()).toBeNull();
      }
      httpTesting.expectNone(URL_CANCEL);
    });

    it('shows the real state when the verified order is not cancelled', async () => {
      (await lose()).error(new ProgressEvent('error'));
      await settle();
      click('.detail__alert button');
      (await vi.waitFor(() => httpTesting.expectOne(URL_DETAIL))).flush(
        ownerOrder({ status: 'ACORDADO', canEdit: false, canCancel: false, images: [] }),
      );
      await flushAssignedOffer();

      expect(text()).not.toContain(UNKNOWN);
      expect(text()).toContain(NOT_REGISTERED);
      expect(text()).toContain('Este pedido tiene un acuerdo');
      expect(cancelButton()).toBeNull();
    });

    it('replaces the warning when the order proves cancelled', async () => {
      (await lose()).flush(CANCELLED);
      await settle();

      expect(text()).not.toContain(UNKNOWN);
      expect(alerts()).toHaveLength(0);
      const verified = element().querySelector('#order-cancelled');
      expect(verified?.textContent).toContain('Verificamos el pedido: consta como cancelado.');
      expect(document.activeElement).toBe(verified);
    });

    it('also replaces it when the order is verified after a failed query', async () => {
      (await lose()).error(new ProgressEvent('error'));
      await settle();
      await reload(CANCELLED);

      expect(text()).not.toContain(UNKNOWN);
      expect(text()).toContain('consta como cancelado');
      expect(cancelButton()).toBeNull();
    });

    it.each([403, 404])('does not repeat a %i when the order cannot be loaded', async (code) => {
      await open();
      send();
      await fail(code, 'Respuesta del backend');
      (await vi.waitFor(() => httpTesting.expectOne(URL_DETAIL))).flush(
        { statusCode: code, message: 'Respuesta del backend' },
        { status: code, statusText: 'Error' },
      );
      await settle();

      expect(alerts().length).toBeLessThanOrEqual(1);
      expect(actionAlert()).toBeNull();
    });
  });
});

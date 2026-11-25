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
  const cancelButton = () => element().querySelector('.cancel__button');

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

  it('cancels with the trimmed reason and shows the returned order', async () => {
    await open();
    click('.cancel__button');
    const reason = element().querySelector<HTMLTextAreaElement>('#cancel-order-reason');
    reason!.value = '  Ya lo resolví  ';
    reason!.dispatchEvent(new Event('input'));

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
    click('.cancel__button');
    click('.dialog__confirm');
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

  it('shows the 409 message and refreshes the order', async () => {
    const message =
      'El pedido ya tiene un acuerdo: no se puede cancelar por esta vía. Use «Cancelar trabajo» (RF-34).';
    await open();
    click('.cancel__button');
    click('.dialog__confirm');

    httpTesting
      .expectOne(URL_CANCEL)
      .flush({ statusCode: 409, message }, { status: 409, statusText: 'Conflict' });
    await settle();
    (await vi.waitFor(() => httpTesting.expectOne(URL_DETAIL))).flush(
      ownerOrder({ status: 'ACORDADO', canEdit: false, canCancel: false, images: [] }),
    );
    await flushAssignedOffer();

    expect(element().querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(cancelButton()).toBeNull();
  });
});

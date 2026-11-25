import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../../core/interceptors/auth.interceptor';
import { PaginatedResponse } from '../../../../core/models/pagination.model';
import { OwnerOrder } from '../../models/order.model';
import { MY_ORDERS_ROUTES } from '../../orders.routes';
import { CLIENT, ownerOrder, stubObjectUrls } from '../../testing/order.fixtures';
import { OrderDetailPageComponent } from '../order-detail-page/order-detail-page.component';
import { MyOrdersPageComponent } from './my-orders-page.component';

const LIST_URL = apiUrl('orders', 'me');

function order(index: number, overrides: Partial<OwnerOrder> = {}): OwnerOrder {
  return ownerOrder({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    images: [],
    ...overrides,
  });
}

function pageOf(
  data: OwnerOrder[],
  meta: Partial<PaginatedResponse<OwnerOrder>['meta']> = {},
): PaginatedResponse<OwnerOrder> {
  return {
    data,
    meta: { page: 1, limit: 12, total: data.length, totalPages: data.length > 0 ? 1 : 0, ...meta },
  };
}

describe('MyOrdersPageComponent', () => {
  let harness: RouterTestingHarness;
  let httpTesting: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    sessionStorage.clear();
    stubObjectUrls();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'cliente/mis-pedidos', children: MY_ORDERS_ROUTES }]),
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    TestBed.inject(SessionStore).setSession({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      user: CLIENT,
    });
    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
  });

  function element(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  function listRequest(): Promise<TestRequest> {
    return vi.waitFor(() => httpTesting.expectOne((request) => request.url === LIST_URL));
  }

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function open(url: string, response: PaginatedResponse<OwnerOrder>): Promise<TestRequest> {
    const navigation = harness.navigateByUrl(url, MyOrdersPageComponent);
    const req = await listRequest();
    req.flush(response);
    await navigation;
    await settle();
    return req;
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(element().querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!found) {
      throw new Error(`No button ${label}`);
    }
    return found;
  }

  function currentUrl(): string {
    return router.url;
  }

  it('lists the orders of the first page with the data returned by the backend', async () => {
    const req = await open('/cliente/mis-pedidos', pageOf([order(1), order(2)]));

    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('12');
    expect(req.request.params.has('status')).toBe(false);

    const cards = element().querySelectorAll('.card');
    expect(cards).toHaveLength(2);
    const text = cards[0].textContent ?? '';
    expect(text).toContain('Plomería');
    expect(text).toContain('Publicado');
    expect(text).toContain('Fuga de agua debajo del lavaplatos');
    expect(text).toContain('Bs 150.50');
    expect(text).toContain('Norte');
    expect(text).toContain('15/11/2026');
    expect(text).toContain('Sin fotografías');
    expect(element().querySelector('[role="status"]')?.textContent).toContain('2 pedidos');
  });

  it('loads the cover thumbnail of each order with the Bearer token', async () => {
    const withPhoto = ownerOrder();
    // Sin esperar la estabilidad: la miniatura queda pendiente hasta que se responde.
    const navigation = harness.navigateByUrl('/cliente/mis-pedidos', MyOrdersPageComponent);
    (await listRequest()).flush(pageOf([withPhoto]));
    await navigation;
    harness.detectChanges();

    const req = await vi.waitFor(() =>
      httpTesting.expectOne(
        (request) =>
          request.url === apiUrl('orders', 'me', withPhoto.id, 'images', withPhoto.images[0].id),
      ),
    );
    expect(req.request.params.get('variant')).toBe('thumb');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    req.flush(new Blob(['webp'], { type: 'image/webp' }));
    await settle();

    expect(element().querySelector('.card img')?.getAttribute('src')).toBe('blob:preview-1');
  });

  it('filters by status in the backend and goes back to the first page', async () => {
    await open('/cliente/mis-pedidos?pagina=2', pageOf([order(1)], { page: 2, totalPages: 2 }));

    const select = element().querySelector<HTMLSelectElement>('#my-orders-status');
    if (!select) {
      throw new Error('No status filter');
    }
    select.value = 'VENCIDO';
    select.dispatchEvent(new Event('change'));

    const req = await listRequest();
    expect(req.request.params.get('status')).toBe('VENCIDO');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pageOf([order(3, { status: 'VENCIDO' })]));
    await settle();

    expect(currentUrl()).toBe('/cliente/mis-pedidos?estado=VENCIDO');
    expect(element().querySelector('.card')?.textContent).toContain('Vencido');
  });

  it('navigates between pages with the backend meta and disables the limits', async () => {
    await open('/cliente/mis-pedidos', pageOf([order(1)], { total: 13, totalPages: 2 }));

    expect(element().querySelector('.pager__info')?.textContent?.trim()).toBe(
      'Página 1 de 2 · 13 resultados',
    );
    expect(button('Anterior').disabled).toBe(true);

    button('Siguiente').click();
    const req = await listRequest();
    expect(req.request.params.get('page')).toBe('2');
    req.flush(pageOf([order(13)], { page: 2, total: 13, totalPages: 2 }));
    await settle();

    expect(currentUrl()).toBe('/cliente/mis-pedidos?pagina=2');
    expect(button('Siguiente').disabled).toBe(true);
    expect(button('Anterior').disabled).toBe(false);
  });

  it('invites to publish the first order when the list is empty', async () => {
    await open('/cliente/mis-pedidos', pageOf([]));

    expect(element().textContent).toContain('Todavía no publicó ningún pedido.');
    expect(element().querySelector('.orders__empty a')?.getAttribute('href')).toBe(
      '/cliente/publicar-pedido',
    );
  });

  it('explains when the selected status has no orders and offers to show all', async () => {
    await open('/cliente/mis-pedidos?estado=CANCELADO', pageOf([]));

    expect(element().textContent).toContain('No tiene pedidos con estado «Cancelado».');
    button('Ver todos los pedidos').click();
    (await listRequest()).flush(pageOf([order(1)]));
    await settle();

    expect(currentUrl()).toBe('/cliente/mis-pedidos');
  });

  it('ignores an unknown status in the URL', async () => {
    const req = await open('/cliente/mis-pedidos?estado=OTRO&pagina=abc', pageOf([]));

    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.get('page')).toBe('1');
  });

  it('shows a connection error with a retry action', async () => {
    const navigation = harness.navigateByUrl('/cliente/mis-pedidos', MyOrdersPageComponent);
    (await listRequest()).error(new ProgressEvent('error'));
    await navigation;
    await settle();

    expect(element().querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudieron cargar sus pedidos',
    );
    button('Reintentar').click();
    (await listRequest()).flush(pageOf([order(1)]));
    await settle();

    expect(element().querySelectorAll('.card')).toHaveLength(1);
  });

  it('shows the authorization message without retry (403)', async () => {
    const navigation = harness.navigateByUrl('/cliente/mis-pedidos', MyOrdersPageComponent);
    (await listRequest()).flush(
      {
        statusCode: 403,
        message: 'No tiene permisos para realizar esta operación',
        error: 'Forbidden',
      },
      { status: 403, statusText: 'Forbidden' },
    );
    await navigation;
    await settle();

    expect(element().querySelector('[role="alert"]')?.textContent).toContain(
      'No tiene permisos para realizar esta operación',
    );
    expect(element().querySelector('[role="alert"] button')).toBeNull();
  });

  it('opens the detail and returns to the same filter and page', async () => {
    const target = order(7, { status: 'PUBLICADO' });
    await open(
      '/cliente/mis-pedidos?estado=PUBLICADO&pagina=2',
      pageOf([target], { page: 2, total: 13, totalPages: 2 }),
    );

    element().querySelector<HTMLAnchorElement>('.card__link')?.click();
    const detail = await vi.waitFor(() => httpTesting.expectOne(apiUrl('orders', 'me', target.id)));
    detail.flush(target);
    await settle();

    expect(currentUrl()).toBe(`/cliente/mis-pedidos/${target.id}`);
    expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(OrderDetailPageComponent);
    const back = element().querySelector<HTMLAnchorElement>('.detail__back');
    expect(back?.getAttribute('href')).toBe('/cliente/mis-pedidos?estado=PUBLICADO&pagina=2');

    back?.click();
    const req = await listRequest();
    expect(req.request.params.get('status')).toBe('PUBLICADO');
    expect(req.request.params.get('page')).toBe('2');
    req.flush(pageOf([target], { page: 2, total: 13, totalPages: 2 }));
    await settle();

    expect(element().querySelector<HTMLSelectElement>('#my-orders-status')?.value).toBe(
      'PUBLICADO',
    );
  });
});

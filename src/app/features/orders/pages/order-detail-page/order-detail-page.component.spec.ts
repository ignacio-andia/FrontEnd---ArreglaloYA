import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../../core/interceptors/auth.interceptor';
import { OrderImage, OwnerOrder } from '../../models/order.model';
import { MY_ORDERS_ROUTES } from '../../orders.routes';
import {
  CLIENT,
  ownerOrder,
  stubObjectUrls,
  answerRecommendations,
  flushRecommendations,
} from '../../testing/order.fixtures';
import { OrderDetailPageComponent } from './order-detail-page.component';

const ORDER = ownerOrder();
const DETAIL_URL = apiUrl('orders', 'me', ORDER.id);

function image(position: number): OrderImage {
  return {
    id: `00000000-0000-4000-8000-00000000000${position}`,
    position,
    width: 1600,
    height: 1200,
    sizeBytes: 90000,
    thumbnailSizeBytes: 12000,
  };
}

describe('OrderDetailPageComponent', () => {
  let harness: RouterTestingHarness;
  let httpTesting: HttpTestingController;

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
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    flushRecommendations(httpTesting);
    httpTesting.verify();
    sessionStorage.clear();
  });

  function element(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  /** Abre el detalle y responde con el pedido (las fotos quedan pendientes). */
  async function open(response: OwnerOrder, id = response.id): Promise<void> {
    const navigation = harness.navigateByUrl(
      `/cliente/mis-pedidos/${id}`,
      OrderDetailPageComponent,
    );
    (await vi.waitFor(() => httpTesting.expectOne(apiUrl('orders', 'me', id)))).flush(response);
    await navigation;
    harness.detectChanges();
    await answerRecommendations(httpTesting);
  }

  /** Responde las descargas de fotos pendientes y devuelve sus peticiones. */
  async function flushImages(): Promise<TestRequest[]> {
    const requests = await vi.waitFor(() => {
      const pending = httpTesting.match((request) => request.url.includes('/images/'));
      if (pending.length === 0) {
        throw new Error('No image requests');
      }
      return pending;
    });
    requests.forEach((request) => request.flush(new Blob(['webp'], { type: 'image/webp' })));
    await harness.fixture.whenStable();
    harness.detectChanges();
    return requests;
  }

  function section(id: string): string {
    return element().querySelector(`[aria-labelledby="${id}"]`)?.textContent ?? '';
  }

  it('shows the complete owner information in sections', async () => {
    await open(ORDER);
    await flushImages();

    expect(element().querySelector('h1')?.textContent?.trim()).toBe('Plomería');
    const service = section('order-service-title');
    expect(service).toContain('Norte');
    expect(service).toContain('Bs 150.50');
    expect(service).toContain('Fuga de agua debajo del lavaplatos de la cocina');
    const info = section('order-info-title');
    expect(info).toContain('Publicado');
    expect(info).toContain('15/11/2026 10:40');
    expect(info).toContain('22/11/2026 10:40');
    const location = section('order-location-title');
    expect(location).toContain('Av. Ejemplo 123');
    expect(location).toContain('Portón verde');
  });

  it('downloads the full photo and switches it from the thumbnails', async () => {
    const order = ownerOrder({ images: [image(1), image(2)] });
    await open(order);
    const first = await flushImages();

    const variants = first.map((request) => [
      request.request.params.get('variant'),
      request.request.url,
    ]);
    expect(variants).toContainEqual([
      'full',
      apiUrl('orders', 'me', order.id, 'images', image(1).id),
    ]);
    expect(variants).toContainEqual([
      'thumb',
      apiUrl('orders', 'me', order.id, 'images', image(2).id),
    ]);
    first.forEach((request) =>
      expect(request.request.headers.get('Authorization')).toBe('Bearer jwt-token'),
    );
    expect(element().querySelector('.gallery__main img')?.getAttribute('alt')).toBe(
      'Fotografía 1 de 2 del pedido',
    );

    const thumbs = element().querySelectorAll<HTMLButtonElement>('.gallery__thumb');
    expect(thumbs[0].getAttribute('aria-pressed')).toBe('true');
    thumbs[1].click();
    harness.detectChanges();
    const [full] = await flushImages();

    expect(full.request.params.get('variant')).toBe('full');
    expect(full.request.url).toBe(apiUrl('orders', 'me', order.id, 'images', image(2).id));
    expect(thumbs[1].getAttribute('aria-pressed')).toBe('true');
    expect(element().querySelector('.gallery__main img')?.getAttribute('alt')).toBe(
      'Fotografía 2 de 2 del pedido',
    );
  });

  it('explains a closed order without address, photos or description', async () => {
    await open(
      ownerOrder({
        status: 'VENCIDO',
        images: [],
        address: null,
        description: 'Descripción no disponible por cierre del pedido.',
        anonymizedAt: '2026-11-22T15:00:00.000Z',
      }),
    );
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(element().textContent).toContain('por privacidad, se eliminaron');
    expect(section('order-location-title')).toContain('La dirección ya no está disponible.');
    expect(section('order-photos-title')).toContain('no tiene fotografías disponibles');
    expect(element().querySelector('app-order-photo')).toBeNull();
  });

  it('shows the order as not found when it does not exist or is not owned (404)', async () => {
    const navigation = harness.navigateByUrl(
      `/cliente/mis-pedidos/${ORDER.id}`,
      OrderDetailPageComponent,
    );
    (await vi.waitFor(() => httpTesting.expectOne(DETAIL_URL))).flush(
      { statusCode: 404, message: 'El pedido no existe', error: 'Not Found' },
      { status: 404, statusText: 'Not Found' },
    );
    await navigation;
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(element().querySelector('h1')?.textContent?.trim()).toBe('Pedido no encontrado');
    expect(element().textContent).toContain('no pertenece a su cuenta');
    expect(element().textContent).not.toContain('Av. Ejemplo');
  });

  it('shows a connection error with a retry action', async () => {
    const navigation = harness.navigateByUrl(
      `/cliente/mis-pedidos/${ORDER.id}`,
      OrderDetailPageComponent,
    );
    (await vi.waitFor(() => httpTesting.expectOne(DETAIL_URL))).error(new ProgressEvent('error'));
    await navigation;
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(element().querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudo cargar el pedido',
    );
    element().querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    (await vi.waitFor(() => httpTesting.expectOne(DETAIL_URL))).flush(ORDER);
    harness.detectChanges();
    await answerRecommendations(httpTesting);
    await flushImages();

    expect(element().querySelector('h1')?.textContent?.trim()).toBe('Plomería');
  });

  it('links back to the plain list when opened directly', async () => {
    await open(ORDER);
    await flushImages();

    expect(element().querySelector('.detail__back')?.getAttribute('href')).toBe(
      '/cliente/mis-pedidos',
    );
  });
});

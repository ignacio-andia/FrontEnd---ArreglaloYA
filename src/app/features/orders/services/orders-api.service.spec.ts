import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SessionStore } from '../../../core/auth/session.store';
import { apiUrl } from '../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { CreateOrderRequest, OrderWithWarnings } from '../models/order.model';
import { CATEGORY, CLIENT, ZONE, ownerOrder, photo } from '../testing/order.fixtures';
import { OrdersApiService } from './orders-api.service';

describe('OrdersApiService', () => {
  let service: OrdersApiService;
  let httpTesting: HttpTestingController;

  const request: CreateOrderRequest = {
    categoryId: CATEGORY.id,
    zoneId: ZONE.id,
    description: 'Fuga de agua debajo del lavaplatos de la cocina',
    budgetAmount: '150.50',
    addressLine: 'Av. Ejemplo 123',
    addressReference: 'Portón verde',
    images: [photo('fuga.jpg'), photo('detalle.png', 'image/png')],
  };

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    TestBed.inject(SessionStore).setSession({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      user: CLIENT,
    });
    service = TestBed.inject(OrdersApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
  });

  it('checks duplicates with the exact DuplicateCheckDto', async () => {
    const result = firstValueFrom(
      service.checkDuplicates({
        categoryId: CATEGORY.id,
        zoneId: ZONE.id,
        description: 'Fuga de agua debajo del lavaplatos',
      }),
    );

    const req = httpTesting.expectOne(apiUrl('orders', 'duplicate-check'));
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    expect(req.request.body).toEqual({
      categoryId: CATEGORY.id,
      zoneId: ZONE.id,
      description: 'Fuga de agua debajo del lavaplatos',
    });
    req.flush({ warnings: [] });

    expect(await result).toEqual({ warnings: [] });
  });

  it('creates the order as multipart with every photo in a repeated "images" field', async () => {
    const response: OrderWithWarnings = { order: ownerOrder(), warnings: [] };
    const result = firstValueFrom(service.createOrder(request));

    const req = httpTesting.expectOne(apiUrl('orders'));
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    // El navegador fija el Content-Type con su boundary.
    expect(req.request.headers.has('Content-Type')).toBe(false);
    const body = req.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(Array.from(body.keys())).toEqual([
      'categoryId',
      'zoneId',
      'description',
      'budgetAmount',
      'addressLine',
      'addressReference',
      'images',
      'images',
    ]);
    expect(body.get('budgetAmount')).toBe('150.50');
    expect(body.get('addressReference')).toBe('Portón verde');
    expect(body.getAll('images').map((file) => (file as File).name)).toEqual([
      'fuga.jpg',
      'detalle.png',
    ]);
    req.flush(response, { status: 201, statusText: 'Created' });

    expect(await result).toEqual(response);
  });

  it('omits addressReference when it is not provided', () => {
    const withoutReference: CreateOrderRequest = { ...request };
    delete withoutReference.addressReference;
    service.createOrder(withoutReference).subscribe();

    const body = httpTesting.expectOne(apiUrl('orders')).request.body as FormData;
    expect(body.has('addressReference')).toBe(false);
  });
});

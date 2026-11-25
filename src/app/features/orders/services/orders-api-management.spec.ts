import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl } from '../../../core/http/api-url';
import { UpdateOrderRequest } from '../models/order.model';
import { photo } from '../testing/order.fixtures';
import { OrdersApiService } from './orders-api.service';

const ORDER_ID = 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b';
const IMAGE_ID = 'f6a7b8c9-d0e1-4f2a-8b3c-4d5e6f7a8b9c';

describe('OrdersApiService (edición, fotografías y cancelación)', () => {
  let service: OrdersApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrdersApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('patches only the defined properties of UpdateOrderDto', () => {
    const request = {
      budgetAmount: '200',
      addressReference: null,
      zoneId: 'no-editable',
    } as UpdateOrderRequest;

    service.update(ORDER_ID, request).subscribe();

    const req = httpTesting.expectOne(apiUrl('orders', 'me', ORDER_ID));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ budgetAmount: '200', addressReference: null });
    req.flush({});
  });

  it.each([
    ['POST', apiUrl('orders', 'me', ORDER_ID, 'images')],
    ['PUT', apiUrl('orders', 'me', ORDER_ID, 'images', IMAGE_ID)],
  ])('sends one photo in the "image" field with %s', (method, url) => {
    const file = photo('fuga.png', 'image/png');
    const call =
      method === 'POST'
        ? service.addImage(ORDER_ID, file)
        : service.replaceImage(ORDER_ID, IMAGE_ID, file);

    call.subscribe();

    const req = httpTesting.expectOne(url);
    expect(req.request.method).toBe(method);
    const body = req.request.body as FormData;
    expect([...body.keys()]).toEqual(['image']);
    expect((body.get('image') as File).name).toBe('fuga.png');
    expect(req.request.headers.has('Content-Type')).toBe(false);
    req.flush({});
  });

  it('deletes a photo', () => {
    service.deleteImage(ORDER_ID, IMAGE_ID).subscribe();

    const req = httpTesting.expectOne(apiUrl('orders', 'me', ORDER_ID, 'images', IMAGE_ID));
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it.each([
    [{}, {}],
    [{ reason: 'Ya lo resolví' }, { reason: 'Ya lo resolví' }],
  ])('cancels the order with %j', (request, body) => {
    service.cancel(ORDER_ID, request).subscribe();

    const req = httpTesting.expectOne(apiUrl('orders', 'me', ORDER_ID, 'cancel'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });
});

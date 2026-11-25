import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl } from '../../../core/http/api-url';
import { OFFER_ID, ORDER_ID } from '../testing/offers.fixtures';
import { OffersApiService } from './offers-api.service';

describe('OffersApiService', () => {
  let api: OffersApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(OffersApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates an offer sending only the accepted fields', () => {
    api
      .create(ORDER_ID, {
        amount: '180',
        requiresVisit: false,
        visitCost: '10',
        materialsIncluded: true,
        proposedStartAt: '2026-11-30T10:00:00-04:00',
        estimatedDurationMinutes: 60,
      })
      .subscribe();

    const request = http.expectOne(apiUrl('offers', 'orders', ORDER_ID));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      amount: '180',
      requiresVisit: false,
      materialsIncluded: true,
      proposedStartAt: '2026-11-30T10:00:00-04:00',
      estimatedDurationMinutes: 60,
    });
    request.flush({});
  });

  it('sends the visit cost only when the offer requires a visit', () => {
    api
      .create(ORDER_ID, {
        amount: '180',
        requiresVisit: true,
        visitCost: '0',
        materialsIncluded: true,
        proposedStartAt: '2026-11-30T10:00:00-04:00',
        estimatedDurationMinutes: 60,
      })
      .subscribe();

    const request = http.expectOne(apiUrl('offers', 'orders', ORDER_ID));
    expect(request.request.body.visitCost).toBe('0');
    request.flush({});
  });

  it('lists own offers without the order filter, which only applies to received ones', () => {
    api.listOwn({ status: 'VIGENTE', orderId: ORDER_ID, page: 2, limit: 12 }).subscribe();
    const own = http.expectOne((request) => request.url === apiUrl('offers', 'me'));
    expect(own.request.params.toString()).toBe('status=VIGENTE&page=2&limit=12');
    own.flush({});

    api.listReceived({ orderId: ORDER_ID }).subscribe();
    const list = http.expectOne((request) => request.url === apiUrl('offers', 'received'));
    expect(list.request.params.toString()).toBe(`orderId=${ORDER_ID}`);
    list.flush({});
  });

  it('reads both details and both WhatsApp contacts', () => {
    const urls = [
      apiUrl('offers', 'me', OFFER_ID),
      apiUrl('offers', 'received', OFFER_ID),
      apiUrl('offers', 'received', OFFER_ID, 'whatsapp'),
      apiUrl('offers', 'me', OFFER_ID, 'whatsapp'),
    ];
    api.getOwn(OFFER_ID).subscribe();
    api.getReceived(OFFER_ID).subscribe();
    api.getWorkerContact(OFFER_ID).subscribe();
    api.getClientContact(OFFER_ID).subscribe();

    for (const url of urls) {
      const request = http.expectOne(url);
      expect(request.request.method).toBe('GET');
      request.flush({});
    }
  });

  it('negotiates with the four action endpoints; only the counteroffer has a body', () => {
    api.counter(OFFER_ID, '170').subscribe();
    const counter = http.expectOne(apiUrl('offers', OFFER_ID, 'counter'));
    expect(counter.request.body).toEqual({ amount: '170' });
    counter.flush({});

    api.accept(OFFER_ID).subscribe();
    api.reject(OFFER_ID).subscribe();
    api.withdraw(OFFER_ID).subscribe();
    for (const action of ['accept', 'reject', 'withdraw']) {
      const request = http.expectOne(apiUrl('offers', OFFER_ID, action));
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toBeNull();
      request.flush({});
    }
  });
});

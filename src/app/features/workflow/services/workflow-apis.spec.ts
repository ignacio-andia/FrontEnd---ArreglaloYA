import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/http/api-url';
import { OffersApiService } from '../../offers/services/offers-api.service';
import { ORDER_ID, offer } from '../../offers/testing/offers.fixtures';
import { Offer } from '../../offers/models/offer.model';
import { TimelineApiService } from './timeline-api.service';
import { WorkflowApiService } from './workflow-api.service';

describe('workflow APIs', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the workflow of an order', () => {
    TestBed.inject(WorkflowApiService).get(ORDER_ID).subscribe();

    const request = http.expectOne(apiUrl('orders', ORDER_ID, 'workflow'));
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it.each([
    ['registerVisit', ['visit']],
    ['confirmVisitPayment', ['visit', 'payment-confirmation']],
    ['startWork', ['start']],
    ['finishWork', ['finish']],
    ['confirmConformity', ['confirm-conformity']],
  ] as const)('%s posts without a body', (method, path) => {
    const result: Observable<unknown> = TestBed.inject(WorkflowApiService)[method](ORDER_ID);
    result.subscribe();

    const request = http.expectOne(apiUrl('orders', ORDER_ID, ...path));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush({});
  });

  it('sends only the fields of the budget DTOs', () => {
    const api = TestBed.inject(WorkflowApiService);
    const url = (...path: string[]) =>
      apiUrl('orders', ORDER_ID, ...(['additional-budgets', ...path] as [string]));
    const send = (path: string, body: unknown) => {
      const request = http.expectOne(path);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(body);
      request.flush({});
    };
    const budget = { amount: '10', reason: 'r', materials: 'm' };

    api.proposeBudget(ORDER_ID, { ...budget, extra: 'x' } as typeof budget).subscribe();
    send(url(), budget);
    api.acceptBudget(ORDER_ID, 'b1').subscribe();
    send(url('b1', 'accept'), null);
    api.rejectBudget(ORDER_ID, 'b1', '').subscribe();
    send(url('b1', 'reject'), {});
    api.rejectBudget(ORDER_ID, 'b1', 'Caro').subscribe();
    send(url('b1', 'reject'), { reason: 'Caro' });
  });

  it('sends only the reason to cancel the work', () => {
    TestBed.inject(WorkflowApiService).cancelWork(ORDER_ID, 'Motivo').subscribe();

    const request = http.expectOne(apiUrl('orders', ORDER_ID, 'cancel-work'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reason: 'Motivo' });
    request.flush({});
  });

  it.each([
    ['', {}],
    ['No llegó', { description: 'No llegó' }],
  ])('reports a no-show with description «%s»', (description, body) => {
    TestBed.inject(WorkflowApiService).reportNoShow(ORDER_ID, description).subscribe();

    const request = http.expectOne(apiUrl('orders', ORDER_ID, 'no-show'));
    expect(request.request.body).toEqual(body);
    request.flush({});
  });

  it('asks the timeline with the page size and, afterwards, the opaque cursor', () => {
    const api = TestBed.inject(TimelineApiService);
    const url = apiUrl('orders', ORDER_ID, 'timeline');

    api.get(ORDER_ID).subscribe();
    const first = http.expectOne((request) => request.url === url);
    expect(first.request.params.toString()).toBe('limit=20');
    first.flush({});

    api.get(ORDER_ID, 'abc==').subscribe();
    const next = http.expectOne((request) => request.url === url);
    expect(next.request.params.get('cursor')).toBe('abc==');
    next.flush({});
  });

  it('looks for the accepted offer of an order across pages', () => {
    let found: Offer | null | undefined;
    TestBed.inject(OffersApiService)
      .findAcceptedForOrder(ORDER_ID)
      .subscribe((value) => (found = value));
    const url = apiUrl('offers', 'me');

    const first = http.expectOne((request) => request.url === url);
    expect(first.request.params.toString()).toBe('status=ACEPTADA&page=1&limit=50');
    first.flush({
      data: [offer({ orderId: 'otro', createdAt: '2020-01-01T00:00:00.000Z' })],
      meta: { page: 1, limit: 50, total: 51, totalPages: 2 },
    });
    const second = http.expectOne((request) => request.url === url);
    second.flush({
      data: [offer({ status: 'ACEPTADA' })],
      meta: { page: 2, limit: 50, total: 51, totalPages: 2 },
    });

    expect(found?.orderId).toBe(ORDER_ID);
  });
});

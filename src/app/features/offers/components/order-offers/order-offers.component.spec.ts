import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiUrl } from '../../../../core/http/api-url';
import { OrderStatus } from '../../../orders/models/order.model';
import { ORDER_ID, page, received } from '../../testing/offers.fixtures';
import { OrderOffersComponent } from './order-offers.component';

describe('OrderOffersComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function open(status: OrderStatus) {
    const fixture = TestBed.createComponent(OrderOffersComponent);
    fixture.componentRef.setInput('orderId', ORDER_ID);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    return fixture;
  }

  it.each(['PUBLICADO', 'EN_NEGOCIACION'] as const)(
    'links to the order offers while the order is %s',
    (status) => {
      const element = open(status).nativeElement as HTMLElement;

      expect(element.querySelector('a')?.getAttribute('href')).toBe(
        `/cliente/ofertas?pedido=${ORDER_ID}`,
      );
    },
  );

  it('shows the assigned worker from the accepted offer', async () => {
    const fixture = open('ACORDADO');
    const request = http.expectOne((req) => req.url === apiUrl('offers', 'received'));
    expect(request.request.params.toString()).toBe(`orderId=${ORDER_ID}&status=ACEPTADA&limit=1`);
    request.flush(page([received({ status: 'ACEPTADA' })]));
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Luis Rojas');
    expect(text).toContain('Bs 180.00');
  });

  it.each(['CANCELADO', 'VENCIDO'] as const)('shows nothing for a %s order', (status) => {
    const element = open(status).nativeElement as HTMLElement;

    expect(element.textContent?.trim()).toBe('');
  });
});

import { TestBed } from '@angular/core/testing';
import { ORDER_STATUSES, OrderStatus } from '../../models/order.model';
import { OrderStatusBadgeComponent } from './order-status-badge.component';

describe('OrderStatusBadgeComponent', () => {
  function render(status: OrderStatus): HTMLElement {
    const fixture = TestBed.createComponent(OrderStatusBadgeComponent);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('.badge') as HTMLElement;
  }

  it.each([
    ['PUBLICADO', 'Publicado', 'badge--open'],
    ['EN_NEGOCIACION', 'En negociación', 'badge--open'],
    ['ACORDADO', 'Acordado', 'badge--agreed'],
    ['CERRADO', 'Cerrado', 'badge--closed'],
    ['VENCIDO', 'Vencido', 'badge--ended'],
    ['CANCELADO', 'Cancelado', 'badge--ended'],
  ] as const)('shows %s as "%s"', (status, label, tone) => {
    const badge = render(status);

    expect(badge.textContent).toBe(label);
    expect(badge.classList).toContain(tone);
  });

  it('has a Spanish label for each of the backend statuses', () => {
    for (const status of ORDER_STATUSES) {
      expect(render(status).textContent).not.toBe(status);
    }
  });
});

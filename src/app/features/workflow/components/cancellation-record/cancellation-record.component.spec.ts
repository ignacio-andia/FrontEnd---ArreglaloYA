import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { OfferParty } from '../../../offers/models/offer.model';
import { ORDER_ID } from '../../../offers/testing/offers.fixtures';
import { TimelineEvent, TimelinePage } from '../../models/timeline.model';
import { ServiceWorkStore } from '../../services/service-work.store';
import { event, timeline } from '../../testing/workflow.fixtures';
import { CancellationRecordComponent } from './cancellation-record.component';

const URL = apiUrl('orders', ORDER_ID, 'timeline');

function cancellation(reason: string | null = 'Cambié de planes'): TimelineEvent {
  return event({
    id: 'cancel',
    type: 'PEDIDO_CANCELADO',
    at: '2026-11-22T14:00:00.000Z',
    summary: 'Pedido cancelado',
    details: { fromStatus: 'EN_EJECUCION', toStatus: 'CANCELADO', reason },
  });
}

describe('CancellationRecordComponent', () => {
  let fixture: ComponentFixture<CancellationRecordComponent>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        ServiceWorkStore,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const content = () =>
    ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  async function render(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  /** Pide solo el historial, como la página del administrador. */
  async function create(viewer: OfferParty | null = 'CLIENTE'): Promise<void> {
    TestBed.inject(ServiceWorkStore).loadHistory(ORDER_ID);
    fixture = TestBed.createComponent(CancellationRecordComponent);
    fixture.componentRef.setInput('viewer', viewer);
    await render();
  }

  const request = (cursor: string | null) =>
    http.expectOne((req) => req.url === URL && req.params.get('cursor') === cursor);

  async function answer(page: TimelinePage, cursor: string | null = null): Promise<void> {
    request(cursor).flush(page);
    await render();
  }

  it('shows who cancelled, when, from which state and why', async () => {
    await create();
    expect(content()).toContain('Consultando los datos de la cancelación');

    await answer(timeline([event(), cancellation()]));

    expect(content()).toContain('Cancelado porCliente (usted)');
    expect(content()).toContain('Fecha22/11/2026 10:00');
    expect(content()).toContain('Estado anteriorEn ejecución');
    expect(content()).toContain('MotivoCambié de planes');
  });

  it.each(['TRABAJADOR', null] as const)('names only the role for %s', async (viewer) => {
    await create(viewer);
    await answer(timeline([cancellation()]));

    expect(content()).toContain('Cancelado porCliente');
    expect(content()).not.toContain('(usted)');
    expect(content()).not.toContain('client ');
  });

  it('does not invent a reason that the backend does not send', async () => {
    await create();
    await answer(timeline([cancellation(null)]));

    expect(content()).toContain('MotivoNo disponible');
  });

  it('follows the cursor until it finds the cancellation', async () => {
    await create();
    await answer(timeline([event()], 'c1'));

    const second = request('c1');
    expect(second.request.params.get('limit')).toBe('100');
    second.flush(timeline([event({ id: 'e2' })], 'c2'));
    await answer(timeline([cancellation()]), 'c2');

    expect(content()).toContain('MotivoCambié de planes');
  });

  it('says so when the history does not record it', async () => {
    await create();
    await answer(timeline([event()]));

    expect(content()).toContain('El historial no registra los datos de la cancelación');
  });

  it('retries a history that failed', async () => {
    await create();
    request(null).flush({ statusCode: 500 }, { status: 500, statusText: 'Error' });
    await render();
    expect(content()).toContain('error en el servidor');

    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    await render();
    await answer(timeline([cancellation()]));

    expect(content()).toContain('MotivoCambié de planes');
  });

  it('retries a following page that failed', async () => {
    await create();
    await answer(timeline([event()], 'c1'));
    request('c1').flush({ statusCode: 500 }, { status: 500, statusText: 'Error' });
    await render();
    expect(content()).toContain('error en el servidor');

    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    await render();
    await answer(timeline([cancellation()]), 'c1');

    expect(content()).toContain('MotivoCambié de planes');
  });
});

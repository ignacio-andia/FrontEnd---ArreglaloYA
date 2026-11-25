import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { OfferParty } from '../../../offers/models/offer.model';
import { ORDER_ID } from '../../../offers/testing/offers.fixtures';
import { OrderStatus } from '../../../orders/models/order.model';
import { stubObjectUrls } from '../../../orders/testing/order.fixtures';
import { Execution, Workflow } from '../../../workflow/models/workflow.model';
import { workflow } from '../../../workflow/testing/workflow.fixtures';
import { CLAIM_ID, claim, resolved } from '../../testing/claims.fixtures';
import { ClaimPanelComponent } from './claim-panel.component';

const CLAIM = apiUrl('orders', ORDER_ID, 'claim');
const image = (id: string) => apiUrl('claims', CLAIM_ID, 'images', id);

function execution(overrides: Partial<Execution> = {}): Execution {
  return {
    orderId: ORDER_ID,
    startedAt: '2026-11-21T10:00:00Z',
    finishedAt: '2026-11-21T12:00:00Z',
    conformityDeadline: '2026-11-28T12:00:00Z',
    conformedAt: null,
    ...overrides,
  };
}

describe('ClaimPanelComponent', () => {
  let fixture: ComponentFixture<ClaimPanelComponent>;
  let http: HttpTestingController;

  beforeEach(() => {
    stubObjectUrls();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const root = () => fixture.nativeElement as HTMLElement;
  const content = () => (root().textContent ?? '').replace(/\s+/g, ' ');

  async function render(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  function create(viewer: OfferParty, state: Workflow = workflow('EN_RECLAMO')): void {
    fixture = TestBed.createComponent(ClaimPanelComponent);
    fixture.componentRef.setInput('viewer', viewer);
    fixture.componentRef.setInput('workflow', state);
    fixture.detectChanges();
  }

  async function open(viewer: OfferParty, body: object, status: OrderStatus = 'EN_RECLAMO') {
    create(viewer, workflow(status, { execution: execution() }));
    http.expectOne(CLAIM).flush(body);
    await render();
  }

  /** Responde las descargas pendientes de fotografías y devuelve sus variantes. */
  async function photos(): Promise<string[]> {
    const requests = http.match((request) => request.url.includes('/images/'));
    const asked = requests.map(
      (request) =>
        `${request.request.url.split('/').at(-1)}:${request.request.params.get('variant')}`,
    );
    requests.forEach((request) => request.flush(new Blob(['x'])));
    await render();
    return asked.sort();
  }

  it.each([
    ['ACORDADO', null],
    ['TERMINADO', execution()],
    ['CANCELADO', null],
    ['CERRADO', null],
    ['CERRADO', execution({ conformedAt: '2026-11-22T10:00:00Z' })],
    ['CERRADO', execution({ finishedAt: null })],
  ] as const)('does not ask for a claim on %s without a possible one', (status, run) => {
    create('CLIENTE', workflow(status, { execution: run }));

    http.expectNone(CLAIM);
    expect(root().style.display).toBe('none');
  });

  it('shows the client the whole claim with its private photos', async () => {
    await open('CLIENTE', claim());

    expect(content()).toContain('Abierto');
    expect(content()).toContain('22/11/2026 10:00');
    expect(content()).toContain('Sigue goteando por la unión');
    expect(content()).toContain('Fotografías del reclamo (2)');
    expect(content()).toContain('Todavía no hay una decisión');
    expect(await photos()).toEqual(['i1:full', 'i1:thumb', 'i2:thumb']);
    expect(root().querySelector('.gallery__main img')?.getAttribute('alt')).toBe(
      'Fotografía 1 de 2 del reclamo',
    );

    root().querySelectorAll<HTMLButtonElement>('.gallery__thumb')[1].click();
    await render();
    expect(await photos()).toEqual(['i2:full']);
  });

  it('shows the client the decision and its justification once resolved', async () => {
    await open('CLIENTE', resolved({ images: [] }), 'CERRADO');

    expect(content()).toContain('Resuelto');
    expect(content()).toContain('El trabajador debe revisar la unión.');
    expect(content()).toContain('Las fotografías muestran la fuga.');
    expect(content()).toContain('23/11/2026 10:00');
    expect(content()).toContain('El reclamo no tiene fotografías disponibles');
  });

  it('marks a photo that cannot be downloaded', async () => {
    await open('CLIENTE', claim({ images: [claim().images[0]] }));
    http
      .expectOne((request) => request.url === image('i1'))
      .flush(new Blob(), { status: 404, statusText: 'Not Found' });
    await render();

    expect(content()).toContain('Imagen no disponible');
  });

  it('shows the worker only the status while it is open', async () => {
    // Aunque llegara de más, no se muestra ni se descarga nada privado.
    await open('TRABAJADOR', claim({ status: 'EN_REVISION' }));

    expect(content()).toContain('En revisión');
    expect(content()).not.toContain('Sigue goteando');
    expect(root().querySelector('app-claim-detail, app-image-gallery')).toBeNull();
    http.expectNone((request) => request.url.includes('/images/'));
  });

  it('shows the worker the decision, without description, photos or justification', async () => {
    await open('TRABAJADOR', resolved(), 'CERRADO');

    expect(content()).toContain('Resuelto');
    expect(content()).toContain('El trabajador debe revisar la unión.');
    expect(content()).not.toContain('Las fotografías muestran la fuga.');
    expect(content()).not.toContain('Sigue goteando');
    http.expectNone((request) => request.url.includes('/images/'));
  });

  it('stays hidden when a closed order had no claim', async () => {
    create('CLIENTE', workflow('CERRADO', { execution: execution() }));
    http.expectOne(CLAIM).flush({ statusCode: 404 }, { status: 404, statusText: 'Not Found' });
    await render();

    expect(root().style.display).toBe('none');
    expect(root().querySelector('app-error-alert')).toBeNull();
  });

  it.each([403, 404, 500])('shows and retries a %i on an order in claim', async (status) => {
    create('CLIENTE');
    http
      .expectOne(CLAIM)
      .flush({ statusCode: status, message: 'Sin reclamo' }, { status, statusText: 'Error' });
    await render();

    root().querySelector<HTMLButtonElement>('app-error-alert button')!.click();
    await render();
    http.expectOne(CLAIM).flush(claim({ images: [] }));
    await render();
    expect(content()).toContain('Sigue goteando');
  });

  it('consults the claim again when the page brings a new state', async () => {
    await open('CLIENTE', claim({ images: [] }));

    fixture.componentRef.setInput('workflow', workflow('CERRADO', { execution: execution() }));
    await render();
    http.expectOne(CLAIM).flush(resolved({ images: [] }));
    await render();
    expect(content()).toContain('Las fotografías muestran la fuga.');
  });
});

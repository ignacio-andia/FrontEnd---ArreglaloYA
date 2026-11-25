import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionStore } from '../../../core/auth/session.store';
import { apiUrl } from '../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../core/interceptors/api-error.interceptor';
import { RoleName } from '../../../core/models/role.model';
import { ownerOrder } from '../../orders/testing/order.fixtures';
import { ClientHomePageComponent } from './client-home-page/client-home-page.component';
import { PublicHomePageComponent } from './public-home-page/public-home-page.component';
import { WorkerHomePageComponent } from './worker-home-page/worker-home-page.component';

describe('home pages', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
  });

  function signIn(roles: RoleName[]): void {
    TestBed.inject(SessionStore).setSession({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      user: {
        id: '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f',
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@example.com',
        phone: null,
        status: 'ACTIVO',
        roles,
        createdAt: '2026-11-15T14:30:00.000Z',
        updatedAt: '2026-11-15T14:30:00.000Z',
      },
    });
  }

  function render<T>(component: Type<T>) {
    const fixture: ComponentFixture<T> = TestBed.createComponent(component);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { element, settle };
  }

  function expectUrl(url: string) {
    return vi.waitFor(() => httpTesting.expectOne((request) => request.url === url));
  }

  it('shows at most six categories on the public home', async () => {
    const { element, settle } = render(PublicHomePageComponent);
    const categories = Array.from({ length: 8 }, (_, index) => ({
      id: `category-${index}`,
      name: `Categoría ${index}`,
      description: null,
    }));

    (await expectUrl(apiUrl('catalogs', 'categories'))).flush(categories);
    await settle();

    expect(element.querySelectorAll('app-category-card')).toHaveLength(6);
    expect(element.querySelector('a[href="/cliente/publicar-pedido"]')).not.toBeNull();
  });

  it('lists the recent orders of the client with a link to each detail', async () => {
    signIn(['CLIENTE']);
    const { element, settle } = render(ClientHomePageComponent);
    const order = ownerOrder();

    const request = await expectUrl(apiUrl('orders', 'me'));
    expect(request.request.params.get('limit')).toBe('3');
    request.flush({ data: [order], meta: { page: 1, limit: 3, total: 5, totalPages: 2 } });
    await settle();

    expect(element.querySelector(`a[href="/cliente/mis-pedidos/${order.id}"]`)).not.toBeNull();
    expect(element.textContent).toContain('Ver todos mis pedidos (5)');
    expect(element.textContent).toContain('Ofrecer mis servicios');
  });

  it('invites the client to publish when there are no orders', async () => {
    signIn(['CLIENTE']);
    const { element, settle } = render(ClientHomePageComponent);

    (await expectUrl(apiUrl('orders', 'me'))).flush({
      data: [],
      meta: { page: 1, limit: 3, total: 0, totalPages: 0 },
    });
    await settle();

    expect(element.querySelector('app-empty-state')?.textContent).toContain(
      'Todavía no publicó ningún pedido.',
    );
  });

  it('shows the eligibility message and reason to the worker', async () => {
    signIn(['TRABAJADOR']);
    const { element, settle } = render(WorkerHomePageComponent);

    (await expectUrl(apiUrl('worker-profile', 'me', 'eligibility'))).flush({
      eligible: false,
      status: 'OBSERVADO',
      message: 'Su perfil de trabajador tiene observaciones.',
      reason: 'Suba una foto legible',
      pendingZoneChangeRequest: null,
      canTakeNewWork: false,
    });
    await settle();

    expect(element.textContent).toContain('Su perfil de trabajador tiene observaciones.');
    expect(element.textContent).toContain('Motivo: Suba una foto legible');
  });
});

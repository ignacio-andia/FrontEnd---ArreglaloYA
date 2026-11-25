import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { User } from './core/auth/auth.models';
import { SessionStore } from './core/auth/session.store';
import { apiErrorInterceptor } from './core/interceptors/api-error.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { RoleName } from './core/models/role.model';
import { apiUrl } from './core/http/api-url';
import { LoginPageComponent } from './features/auth/pages/login-page/login-page.component';
import { CategoriesPageComponent } from './features/catalogs/pages/categories-page/categories-page.component';
import { MyOrdersPageComponent } from './features/orders/pages/my-orders-page/my-orders-page.component';
import { PublishOrderPageComponent } from './features/orders/pages/publish-order-page/publish-order-page.component';
import { BecomeWorkerPageComponent } from './features/worker-profile/pages/become-worker-page/become-worker-page.component';
import { AccountPageComponent } from './features/users/pages/account-page/account-page.component';
import { RegisterPageComponent } from './features/auth/pages/register-page/register-page.component';
import { PublicHomePageComponent } from './features/home/pages/public-home-page/public-home-page.component';
import { HowItWorksPageComponent } from './features/home/pages/how-it-works-page/how-it-works-page.component';
import { ClientHomePageComponent } from './features/home/pages/client-home-page/client-home-page.component';
import { WorkerHomePageComponent } from './features/home/pages/worker-home-page/worker-home-page.component';
import { AdminHomePageComponent } from './features/home/pages/admin-home-page/admin-home-page.component';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';
import { ClientLayoutComponent } from './layouts/client-layout/client-layout.component';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';
import { WorkerLayoutComponent } from './layouts/worker-layout/worker-layout.component';

function userWithRoles(roles: RoleName[]): User {
  return {
    id: '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f',
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    phone: null,
    status: 'ACTIVO',
    roles,
    createdAt: '2026-11-15T14:30:00.000Z',
    updatedAt: '2026-11-15T14:30:00.000Z',
  };
}

/** Respuestas vacías de las peticiones que hacen las páginas de inicio. */
const HOME_RESPONSES: Record<string, object> = {
  [apiUrl('catalogs', 'categories')]: [],
  [apiUrl('catalogs', 'zones')]: [],
  [apiUrl('orders', 'me')]: { data: [], meta: { page: 1, limit: 3, total: 0, totalPages: 0 } },
  [apiUrl('worker-profile', 'me', 'eligibility')]: {
    eligible: false,
    status: 'BORRADOR',
    message: 'Su perfil de trabajador está en borrador.',
    reason: null,
    pendingZoneChangeRequest: null,
    canTakeNewWork: false,
  },
};

describe('app routes', () => {
  let httpTesting: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    flushHomeRequests();
    httpTesting.verify();
    sessionStorage.clear();
  });

  function signIn(roles: RoleName[]): void {
    TestBed.inject(SessionStore).setSession({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      user: userWithRoles(roles),
    });
  }

  function flushHomeRequests(): void {
    for (const request of httpTesting.match((r) => r.url in HOME_RESPONSES)) {
      request.flush(HOME_RESPONSES[request.request.url]);
    }
  }

  /** Responde las peticiones de las páginas de inicio mientras se completa la navegación. */
  async function settle<T>(navigation: Promise<T>): Promise<T> {
    let done = false;
    const result = navigation.finally(() => (done = true));
    while (!done) {
      flushHomeRequests();
      await new Promise((resolve) => setTimeout(resolve));
    }
    const value = await result;
    // La página de inicio pide sus datos al mostrarse, ya terminada la navegación.
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    flushHomeRequests();
    return value;
  }

  function visit(harness: RouterTestingHarness, url: string, component?: Type<unknown>) {
    return settle(component ? harness.navigateByUrl(url, component) : harness.navigateByUrl(url));
  }

  function currentPath(): string {
    return router.url.split('?')[0];
  }

  it('renders the public layout at the root', async () => {
    const harness = await RouterTestingHarness.create();

    await visit(harness, '/', PublicLayoutComponent);
    expect(TestBed.inject(Title).getTitle()).toBe('ArreglaloYA');
  });

  it('renders the register page inside the public layout', async () => {
    const harness = await RouterTestingHarness.create();

    await visit(harness, '/auth/registro', PublicLayoutComponent);
    expect(
      harness.routeDebugElement?.query(
        (node) => node.componentInstance instanceof RegisterPageComponent,
      ),
    ).not.toBeNull();
  });

  it('renders the public categories page at /categorias', async () => {
    const harness = await RouterTestingHarness.create();

    const navigation = harness.navigateByUrl('/categorias', PublicLayoutComponent);
    const categories = await vi.waitFor(() =>
      httpTesting.expectOne(apiUrl('catalogs', 'categories')),
    );
    categories.flush([]);
    await navigation;

    expect(currentPath()).toBe('/categorias');
    expect(TestBed.inject(Title).getTitle()).toBe('Categorías | ArreglaloYA');
    expect(
      harness.routeDebugElement?.query(
        (node) => node.componentInstance instanceof CategoriesPageComponent,
      ),
    ).not.toBeNull();
  });

  it('updates the document title when leaving the register page', async () => {
    const title = TestBed.inject(Title);
    const harness = await RouterTestingHarness.create();

    await visit(harness, '/auth/registro');
    expect(title.getTitle()).toBe('Crear cuenta | ArreglaloYA');

    signIn(['CLIENTE']);
    await visit(harness, '/cliente');
    expect(title.getTitle()).toBe('Área de cliente | ArreglaloYA');
  });

  it('redirects unknown URLs to the public root', async () => {
    const harness = await RouterTestingHarness.create();

    await visit(harness, '/no-existe', PublicLayoutComponent);
    expect(currentPath()).toBe('/');
  });

  it('sends visitors from private areas to the login page with returnUrl', async () => {
    const harness = await RouterTestingHarness.create();

    for (const url of ['/cliente', '/trabajador', '/admin']) {
      await visit(harness, url);
      expect(currentPath()).toBe('/auth/login');
      expect(router.parseUrl(router.url).queryParams['returnUrl']).toBe(url);
      expect(
        harness.routeDebugElement?.query(
          (node) => node.componentInstance instanceof LoginPageComponent,
        ),
      ).not.toBeNull();
    }
  });

  it.each([
    [['CLIENTE'], '/cliente'],
    [['CLIENTE', 'TRABAJADOR'], '/trabajador'],
    [['ADMINISTRADOR'], '/admin'],
  ] as const)(
    'redirects a signed-in %j account away from login and register to %s',
    async (roles, area) => {
      signIn([...roles]);
      const harness = await RouterTestingHarness.create();

      for (const url of ['/auth/login', '/auth/registro']) {
        await visit(harness, url);
        expect(currentPath()).toBe(area);
      }
      expect(TestBed.inject(SessionStore).token()).toBe('jwt-token');
    },
  );

  it('restores the session after a reload before leaving the login page', async () => {
    sessionStorage.setItem('servicios-hogar.access-token', 'stored-token');
    const harness = await RouterTestingHarness.create();

    const navigation = harness.navigateByUrl('/auth/login');
    // La ruta /auth se carga de forma diferida: la petición llega tras resolver el chunk.
    const me = await vi.waitFor(() => httpTesting.expectOne(apiUrl('auth', 'me')));
    me.flush(userWithRoles(['CLIENTE']));
    await settle(navigation);

    expect(currentPath()).toBe('/cliente');
  });

  it('opens the client area for a CLIENTE account', async () => {
    signIn(['CLIENTE']);
    const harness = await RouterTestingHarness.create();

    await visit(harness, '/cliente', ClientLayoutComponent);
  });

  it('keeps a CLIENTE-only account out of the worker and admin areas', async () => {
    signIn(['CLIENTE']);
    const harness = await RouterTestingHarness.create();

    await visit(harness, '/trabajador');
    expect(currentPath()).toBe('/acceso-denegado');
    await visit(harness, '/admin');
    expect(currentPath()).toBe('/acceso-denegado');
    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(true);
  });

  it('opens both client and worker areas for an account with both roles', async () => {
    signIn(['CLIENTE', 'TRABAJADOR']);
    const harness = await RouterTestingHarness.create();

    await visit(harness, '/cliente', ClientLayoutComponent);
    await visit(harness, '/trabajador', WorkerLayoutComponent);
  });

  it('does not require worker approval for the worker area root', async () => {
    signIn(['CLIENTE', 'TRABAJADOR']);
    const harness = await RouterTestingHarness.create();

    await visit(harness, '/trabajador', WorkerLayoutComponent);

    expect(currentPath()).toBe('/trabajador');
  });

  it('lets a CLIENTE without the TRABAJADOR role open «Quiero ofrecer mis servicios»', async () => {
    signIn(['CLIENTE']);
    const harness = await RouterTestingHarness.create();

    const navigation = harness.navigateByUrl('/cliente/ofrecer-servicios', ClientLayoutComponent);
    // La página carga los catálogos públicos para el formulario de creación.
    (await vi.waitFor(() => httpTesting.expectOne(apiUrl('catalogs', 'zones')))).flush([]);
    (await vi.waitFor(() => httpTesting.expectOne(apiUrl('catalogs', 'categories')))).flush([]);
    await navigation;

    expect(currentPath()).toBe('/cliente/ofrecer-servicios');
    expect(TestBed.inject(Title).getTitle()).toBe('Ofrecer mis servicios | ArreglaloYA');
    expect(
      harness.routeDebugElement?.query(
        (node) => node.componentInstance instanceof BecomeWorkerPageComponent,
      ),
    ).not.toBeNull();
  });

  it('opens «Mis pedidos» from the client menu', async () => {
    signIn(['CLIENTE']);
    const harness = await RouterTestingHarness.create();
    await visit(harness, '/cliente', ClientLayoutComponent);

    const link = Array.from(
      (harness.routeNativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('nav a'),
    ).find((anchor) => anchor.textContent?.trim() === 'Mis pedidos');
    expect(link?.getAttribute('href')).toBe('/cliente/mis-pedidos');
    link?.click();
    (
      await vi.waitFor(() =>
        httpTesting.expectOne((request) => request.url === apiUrl('orders', 'me')),
      )
    ).flush({ data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } });
    await vi.waitFor(() => expect(currentPath()).toBe('/cliente/mis-pedidos'));
    await harness.fixture.whenStable();

    expect(TestBed.inject(Title).getTitle()).toBe('Mis pedidos | ArreglaloYA');
    expect(
      harness.routeDebugElement?.query(
        (node) => node.componentInstance instanceof MyOrdersPageComponent,
      ),
    ).not.toBeNull();
  });

  it('keeps «Mis pedidos» closed for an account without the CLIENTE role', async () => {
    signIn(['TRABAJADOR']);
    const harness = await RouterTestingHarness.create();

    await visit(harness, '/cliente/mis-pedidos/e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b');

    expect(currentPath()).toBe('/acceso-denegado');
  });

  it('opens «Publicar pedido» in the client area', async () => {
    signIn(['CLIENTE']);
    const harness = await RouterTestingHarness.create();

    const navigation = harness.navigateByUrl('/cliente/publicar-pedido', ClientLayoutComponent);
    (await vi.waitFor(() => httpTesting.expectOne(apiUrl('catalogs', 'categories')))).flush([]);
    (await vi.waitFor(() => httpTesting.expectOne(apiUrl('catalogs', 'zones')))).flush([]);
    await navigation;

    expect(currentPath()).toBe('/cliente/publicar-pedido');
    expect(TestBed.inject(Title).getTitle()).toBe('Publicar pedido | ArreglaloYA');
    expect(
      harness.routeDebugElement?.query(
        (node) => node.componentInstance instanceof PublishOrderPageComponent,
      ),
    ).not.toBeNull();
  });

  it('keeps «Publicar pedido» closed for an account without the CLIENTE role', async () => {
    signIn(['TRABAJADOR']);
    const harness = await RouterTestingHarness.create();

    await visit(harness, '/cliente/publicar-pedido');

    expect(currentPath()).toBe('/acceso-denegado');
  });

  it('opens «Mi cuenta» in the client area', async () => {
    signIn(['CLIENTE']);
    const harness = await RouterTestingHarness.create();

    const navigation = harness.navigateByUrl('/cliente/mi-cuenta', ClientLayoutComponent);
    (await vi.waitFor(() => httpTesting.expectOne(apiUrl('auth', 'me')))).flush(
      userWithRoles(['CLIENTE']),
    );
    await navigation;

    expect(currentPath()).toBe('/cliente/mi-cuenta');
    expect(TestBed.inject(Title).getTitle()).toBe('Mi cuenta | ArreglaloYA');
    expect(
      harness.routeDebugElement?.query(
        (node) => node.componentInstance instanceof AccountPageComponent,
      ),
    ).not.toBeNull();
  });

  it('keeps «Mi perfil» of the worker area closed for a CLIENTE-only account', async () => {
    signIn(['CLIENTE']);
    const harness = await RouterTestingHarness.create();

    await visit(harness, '/trabajador/perfil');

    expect(currentPath()).toBe('/acceso-denegado');
    httpTesting.expectNone(apiUrl('worker-profile', 'me'));
  });

  it('opens «Mi perfil» for the TRABAJADOR role without requiring approval', async () => {
    signIn(['CLIENTE', 'TRABAJADOR']);
    const harness = await RouterTestingHarness.create();

    const navigation = harness.navigateByUrl('/trabajador/perfil', WorkerLayoutComponent);
    (await vi.waitFor(() => httpTesting.expectOne(apiUrl('worker-profile', 'me')))).flush(
      { statusCode: 404, message: 'Aún no tiene un perfil de trabajador', error: 'Not Found' },
      { status: 404, statusText: 'Not Found' },
    );
    (
      await vi.waitFor(() => httpTesting.expectOne(apiUrl('worker-profile', 'me', 'eligibility')))
    ).flush({
      eligible: false,
      status: null,
      message: 'No tiene un perfil de trabajador.',
      reason: null,
      pendingZoneChangeRequest: null,
      canTakeNewWork: false,
    });
    await navigation;

    expect(currentPath()).toBe('/trabajador/perfil');
    expect(TestBed.inject(Title).getTitle()).toBe('Mi perfil de trabajador | ArreglaloYA');
  });

  it('opens the admin area for an ADMINISTRADOR account', async () => {
    signIn(['ADMINISTRADOR']);
    const harness = await RouterTestingHarness.create();

    await visit(harness, '/admin', AdminLayoutComponent);
  });

  it.each([
    ['/', 'ArreglaloYA', PublicHomePageComponent],
    ['/como-funciona', 'Cómo funciona | ArreglaloYA', HowItWorksPageComponent],
  ] as const)('renders the public page %s', async (url, title, page) => {
    const harness = await RouterTestingHarness.create();

    await visit(harness, url, PublicLayoutComponent);

    expect(TestBed.inject(Title).getTitle()).toBe(title);
    expect(
      harness.routeDebugElement?.query((node) => node.componentInstance instanceof page),
    ).not.toBeNull();
  });

  it.each([
    ['/cliente', ClientHomePageComponent],
    ['/trabajador', WorkerHomePageComponent],
    ['/admin', AdminHomePageComponent],
  ] as const)('shows a home page at the root of %s', async (url, page) => {
    signIn(['CLIENTE', 'TRABAJADOR', 'ADMINISTRADOR']);
    const harness = await RouterTestingHarness.create();

    await visit(harness, url);

    expect(
      harness.routeDebugElement?.query((node) => node.componentInstance instanceof page),
    ).not.toBeNull();
  });

  it.each([
    [['TRABAJADOR'], '/trabajador/mi-cuenta'],
    [['ADMINISTRADOR'], '/admin/mi-cuenta'],
  ] as const)('opens «Mi cuenta» for %j at %s', async (roles, url) => {
    signIn([...roles]);
    const harness = await RouterTestingHarness.create();

    const navigation = harness.navigateByUrl(url);
    (await vi.waitFor(() => httpTesting.expectOne(apiUrl('auth', 'me')))).flush(
      userWithRoles([...roles]),
    );
    await navigation;

    expect(currentPath()).toBe(url);
    expect(TestBed.inject(Title).getTitle()).toBe('Mi cuenta | ArreglaloYA');
  });

  it('keeps the order edition closed for an account without the CLIENTE role', async () => {
    signIn(['TRABAJADOR']);
    const harness = await RouterTestingHarness.create();

    await visit(harness, '/cliente/mis-pedidos/e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b/editar');

    expect(currentPath()).toBe('/acceso-denegado');
    httpTesting.expectNone((request) => request.url.includes('/orders/'));
  });

  it('asks a visitor to sign in before editing an order, keeping the returnUrl', async () => {
    const url = '/cliente/mis-pedidos/e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b/editar';
    const harness = await RouterTestingHarness.create();

    await visit(harness, url);

    expect(currentPath()).toBe('/auth/login');
    expect(router.parseUrl(router.url).queryParams['returnUrl']).toBe(url);
  });

  it('sends an authenticated user to the login when the API answers 401', async () => {
    signIn(['CLIENTE']);
    const harness = await RouterTestingHarness.create();
    await visit(harness, '/cliente');

    const navigation = harness.navigateByUrl('/cliente/mis-pedidos');
    (
      await vi.waitFor(() =>
        httpTesting.expectOne((request) => request.url === apiUrl('orders', 'me')),
      )
    ).flush(
      { statusCode: 401, message: 'Sesión inválida', error: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await navigation;

    await vi.waitFor(() => expect(currentPath()).toBe('/auth/login'));
    expect(router.parseUrl(router.url).queryParams['returnUrl']).toBe('/cliente/mis-pedidos');
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(document.body.textContent).toContain('Su sesión terminó');
  });
});

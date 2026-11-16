import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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
import { RegisterPageComponent } from './features/auth/pages/register-page/register-page.component';
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

  function currentPath(): string {
    return router.url.split('?')[0];
  }

  it('renders the public layout at the root', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/', PublicLayoutComponent);
    expect(TestBed.inject(Title).getTitle()).toBe('ArreglaloYA');
  });

  it('renders the register page inside the public layout', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/auth/registro', PublicLayoutComponent);
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

    await harness.navigateByUrl('/auth/registro');
    expect(title.getTitle()).toBe('Crear cuenta | ArreglaloYA');

    signIn(['CLIENTE']);
    await harness.navigateByUrl('/cliente');
    expect(title.getTitle()).toBe('Área de cliente | ArreglaloYA');
  });

  it('redirects unknown URLs to the public root', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/no-existe', PublicLayoutComponent);
    expect(currentPath()).toBe('/');
  });

  it('sends visitors from private areas to the login page with returnUrl', async () => {
    const harness = await RouterTestingHarness.create();

    for (const url of ['/cliente', '/trabajador', '/admin']) {
      await harness.navigateByUrl(url);
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
        await harness.navigateByUrl(url);
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
    await navigation;

    expect(currentPath()).toBe('/cliente');
  });

  it('opens the client area for a CLIENTE account', async () => {
    signIn(['CLIENTE']);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/cliente', ClientLayoutComponent);
  });

  it('keeps a CLIENTE-only account out of the worker and admin areas', async () => {
    signIn(['CLIENTE']);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/trabajador');
    expect(currentPath()).toBe('/');
    await harness.navigateByUrl('/admin');
    expect(currentPath()).toBe('/');
    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(true);
  });

  it('opens both client and worker areas for an account with both roles', async () => {
    signIn(['CLIENTE', 'TRABAJADOR']);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/cliente', ClientLayoutComponent);
    await harness.navigateByUrl('/trabajador', WorkerLayoutComponent);
  });

  it('does not require worker approval for the worker area root', async () => {
    signIn(['CLIENTE', 'TRABAJADOR']);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/trabajador', WorkerLayoutComponent);

    httpTesting.expectNone(() => true);
  });

  it('opens the admin area for an ADMINISTRADOR account', async () => {
    signIn(['ADMINISTRADOR']);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/admin', AdminLayoutComponent);
  });
});

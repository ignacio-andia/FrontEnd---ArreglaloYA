import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  GuardResult,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';
import { User } from '../auth/auth.models';
import { SessionStore } from '../auth/session.store';
import { apiUrl } from '../http/api-url';
import { apiErrorInterceptor } from '../interceptors/api-error.interceptor';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { authGuard } from './auth.guard';

const TOKEN_STORAGE_KEY = 'servicios-hogar.access-token';

const user: User = {
  id: '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f',
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.com',
  phone: null,
  status: 'ACTIVO',
  roles: ['CLIENTE'],
  createdAt: '2026-11-15T14:30:00.000Z',
  updatedAt: '2026-11-15T14:30:00.000Z',
};

function runGuard(guard: CanActivateFn, url: string): Promise<GuardResult> {
  const result = TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
  return isObservable(result) ? firstValueFrom(result) : Promise.resolve(result);
}

function expectLoginRedirect(result: GuardResult, returnUrl: string | undefined): void {
  expect(result).toBeInstanceOf(UrlTree);
  const tree = result as UrlTree;
  expect(TestBed.inject(Router).serializeUrl(new UrlTree(tree.root))).toBe('/auth/login');
  expect(tree.queryParams['returnUrl']).toBe(returnUrl);
}

describe('authGuard', () => {
  let httpTesting: HttpTestingController;

  function setup(storedToken: string | null = null): SessionStore {
    if (storedToken !== null) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, storedToken);
    }
    httpTesting = TestBed.inject(HttpTestingController);
    return TestBed.inject(SessionStore);
  }

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('allows an authenticated user without extra requests', async () => {
    const session = setup();
    session.setSession({ accessToken: 'jwt-token', tokenType: 'Bearer', user });

    expect(await runGuard(authGuard, '/cliente/pedidos')).toBe(true);
  });

  it('redirects to login with returnUrl when there is no session', async () => {
    setup();

    const result = await runGuard(authGuard, '/cliente/pedidos?status=PUBLICADO');

    expectLoginRedirect(result, '/cliente/pedidos?status=PUBLICADO');
  });

  it('restores a session with a stored token before allowing access', async () => {
    const session = setup('stored-token');

    const result = runGuard(authGuard, '/cliente/pedidos');
    httpTesting.expectOne(apiUrl('auth', 'me')).flush(user);

    expect(await result).toBe(true);
    expect(session.isAuthenticated()).toBe(true);
  });

  it('redirects to login when the stored token is invalid (401)', async () => {
    const session = setup('expired-token');

    const result = runGuard(authGuard, '/cliente/pedidos');
    httpTesting
      .expectOne(apiUrl('auth', 'me'))
      .flush(
        { statusCode: 401, message: 'Sesión inválida', error: 'Unauthorized' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expectLoginRedirect(await result, '/cliente/pedidos');
    expect(session.hasToken()).toBe(false);
  });

  it('does not treat hasToken as authenticated when restoration fails by network', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const session = setup('stored-token');

    const result = runGuard(authGuard, '/cliente/pedidos');
    httpTesting.expectOne(apiUrl('auth', 'me')).error(new ProgressEvent('error'));

    expectLoginRedirect(await result, '/cliente/pedidos');
    expect(session.hasToken()).toBe(true);
    expect(session.isAuthenticated()).toBe(false);
  });

  it('retries restoration on a later navigation after a network error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setup('stored-token');

    const first = runGuard(authGuard, '/cliente/pedidos');
    httpTesting.expectOne(apiUrl('auth', 'me')).error(new ProgressEvent('error'));
    await first;

    const second = runGuard(authGuard, '/cliente/pedidos');
    httpTesting.expectOne(apiUrl('auth', 'me')).flush(user);

    expect(await second).toBe(true);
  });

  it.each(['/', '/auth/login', '/auth/login?returnUrl=%2Fcliente', '/auth'])(
    'does not keep returnUrl for %s to avoid navigation cycles',
    async (url) => {
      setup();

      expectLoginRedirect(await runGuard(authGuard, url), undefined);
    },
  );
});

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
import { RoleName } from '../models/role.model';
import { authGuard } from './auth.guard';
import { roleGuard } from './role.guard';

const TOKEN_STORAGE_KEY = 'servicios-hogar.access-token';

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

function runGuard(guard: CanActivateFn, url: string): Promise<GuardResult> {
  const result = TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
  return isObservable(result) ? firstValueFrom(result) : Promise.resolve(result);
}

function serialize(result: GuardResult): string {
  expect(result).toBeInstanceOf(UrlTree);
  return TestBed.inject(Router).serializeUrl(result as UrlTree);
}

describe('roleGuard', () => {
  let httpTesting: HttpTestingController;
  let session: SessionStore;

  function signIn(roles: RoleName[]): void {
    session.setSession({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      user: userWithRoles(roles),
    });
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
  });

  function setup(storedToken: string | null = null): void {
    if (storedToken !== null) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, storedToken);
    }
    httpTesting = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  }

  it('allows a user with an allowed role', async () => {
    setup();
    signIn(['CLIENTE']);

    expect(await runGuard(roleGuard(['CLIENTE']), '/cliente/pedidos')).toBe(true);
  });

  it('allows when the user has any of several allowed roles', async () => {
    setup();
    signIn(['TRABAJADOR']);

    expect(await runGuard(roleGuard(['CLIENTE', 'TRABAJADOR']), '/trabajador')).toBe(true);
  });

  it('redirects without closing the session when the role is missing', async () => {
    setup();
    signIn(['CLIENTE']);

    const result = await runGuard(roleGuard(['TRABAJADOR']), '/trabajador');

    expect(serialize(result)).toBe('/acceso-denegado');
    expect(session.isAuthenticated()).toBe(true);
    expect(session.token()).toBe('jwt-token');
  });

  it('treats an account with CLIENTE and TRABAJADOR as both', async () => {
    setup();
    signIn(['CLIENTE', 'TRABAJADOR']);

    expect(await runGuard(roleGuard(['CLIENTE']), '/cliente/pedidos')).toBe(true);
    expect(await runGuard(roleGuard(['TRABAJADOR']), '/trabajador')).toBe(true);
    expect(serialize(await runGuard(roleGuard(['ADMINISTRADOR']), '/admin'))).toBe(
      '/acceso-denegado',
    );
  });

  it('redirects to login with returnUrl when there is no session', async () => {
    setup();

    const result = await runGuard(roleGuard(['ADMINISTRADOR']), '/admin');

    expect(serialize(result)).toBe('/auth/login?returnUrl=%2Fadmin');
  });

  it('waits for the shared session restoration used by authGuard', async () => {
    setup('stored-token');

    const auth = runGuard(authGuard, '/admin');
    const role = runGuard(roleGuard(['ADMINISTRADOR']), '/admin');
    httpTesting.expectOne(apiUrl('auth', 'me')).flush(userWithRoles(['ADMINISTRADOR']));

    expect(await auth).toBe(true);
    expect(await role).toBe(true);
  });
});

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AuthResponse } from '../../../../core/auth/auth.models';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../../core/interceptors/auth.interceptor';
import { RoleName } from '../../../../core/models/role.model';
import { LoginPageComponent } from './login-page.component';

const LOGIN_URL = apiUrl('auth', 'login');

function authResponse(roles: RoleName[]): AuthResponse {
  return {
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
  };
}

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let element: HTMLElement;
  let httpTesting: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  function render(returnUrl: string | null = null): void {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnUrl === null ? {} : { returnUrl }) },
          },
        },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPageComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  function input(id: 'email' | 'password'): HTMLInputElement {
    const found = element.querySelector<HTMLInputElement>(`#login-${id}`);
    if (!found) {
      throw new Error(`Input ${id} not found`);
    }
    return found;
  }

  function type(id: 'email' | 'password', value: string): void {
    const field = input(id);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
  }

  async function submit(): Promise<void> {
    element.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function loginAs(roles: RoleName[]): Promise<void> {
    type('email', 'ana@example.com');
    type('password', 'Clave1234');
    await submit();
    httpTesting.expectOne(LOGIN_URL).flush(authResponse(roles));
    await fixture.whenStable();
  }

  function errorText(id: 'email' | 'password'): string | null {
    return element.querySelector(`#login-${id}-error`)?.textContent?.trim() ?? null;
  }

  function summary(): HTMLElement | null {
    return element.querySelector('#login-error-summary');
  }

  describe('validation', () => {
    beforeEach(() => render());

    it('requires email and password and focuses the first invalid field', async () => {
      await submit();

      httpTesting.expectNone(LOGIN_URL);
      expect(errorText('email')).toBe('Ingrese su correo electrónico.');
      expect(errorText('password')).toBe('Ingrese su contraseña.');
      expect(input('email').getAttribute('aria-invalid')).toBe('true');
      expect(input('email').getAttribute('aria-describedby')).toBe('login-email-error');
      expect(document.activeElement).toBe(input('email'));
    });

    it('validates the email format and length', () => {
      type('email', 'ana@example');
      fixture.detectChanges();
      expect(errorText('email')).toContain('correo electrónico válido');

      type('email', `${'a'.repeat(250)}@example.com`);
      fixture.detectChanges();
      expect(errorText('email')).toBe('Use como máximo 255 caracteres.');
    });

    it('does not apply registration password rules', async () => {
      type('email', 'ana@example.com');
      type('password', 'x');
      await submit();

      expect(errorText('password')).toBeNull();
      httpTesting.expectOne(LOGIN_URL).flush(authResponse(['CLIENTE']));
    });

    it('limits the password to 255 characters', () => {
      type('password', 'a'.repeat(256));
      fixture.detectChanges();

      expect(errorText('password')).toBe('Use como máximo 255 caracteres.');
    });

    it('toggles the password visibility', () => {
      const toggle = element.querySelector<HTMLButtonElement>('.field__toggle');

      toggle?.click();
      fixture.detectChanges();

      expect(input('password').type).toBe('text');
      expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    });

    it('links to the register page', () => {
      expect(element.querySelector('.auth-card__footer a')?.getAttribute('href')).toBe(
        '/auth/registro',
      );
    });
  });

  describe('login', () => {
    it('sends the exact LoginDto through AuthService and stores the session', async () => {
      render();
      type('email', '  ana@example.com ');
      type('password', ' Clave1234 ');
      await submit();

      const req = httpTesting.expectOne(LOGIN_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'ana@example.com', password: ' Clave1234 ' });
      req.flush(authResponse(['CLIENTE']));
      await fixture.whenStable();

      expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(true);
      expect(navigate).toHaveBeenCalledWith('/cliente');
    });

    it.each([
      [['CLIENTE'], '/cliente'],
      [['TRABAJADOR'], '/trabajador'],
      [['CLIENTE', 'TRABAJADOR'], '/trabajador'],
      [['ADMINISTRADOR'], '/admin'],
    ] as const)('redirects a %j account to %s without returnUrl', async (roles, path) => {
      render();
      await loginAs([...roles]);

      expect(navigate).toHaveBeenCalledWith(path);
    });

    it('returns to a safe returnUrl', async () => {
      render('/cliente/pedidos?status=PUBLICADO');
      await loginAs(['CLIENTE', 'TRABAJADOR']);

      expect(navigate).toHaveBeenCalledWith('/cliente/pedidos?status=PUBLICADO');
    });

    it.each([
      'https://malicioso.example.com',
      '//malicioso.example.com',
      '/\\malicioso.example.com',
    ])('ignores the external returnUrl %s', async (returnUrl) => {
      render(returnUrl);
      await loginAs(['CLIENTE']);

      expect(navigate).toHaveBeenCalledWith('/cliente');
    });

    it('disables the button while submitting and ignores repeated submits', async () => {
      render();
      type('email', 'ana@example.com');
      type('password', 'Clave1234');
      await submit();
      await submit();

      const button = element.querySelector<HTMLButtonElement>('button[type="submit"]');
      expect(button?.disabled).toBe(true);
      expect(button?.textContent?.trim()).toBe('Iniciando sesión…');
      httpTesting.expectOne(LOGIN_URL).flush(authResponse(['CLIENTE']));
    });
  });

  describe('backend errors', () => {
    beforeEach(async () => {
      render();
      type('email', 'ana@example.com');
      type('password', 'incorrecta');
      await submit();
    });

    async function respond(body: object, status: number, statusText: string): Promise<void> {
      httpTesting.expectOne(LOGIN_URL).flush(body, { status, statusText });
      fixture.detectChanges();
      await fixture.whenStable();
    }

    it('shows invalid credentials (401) without starting a session', async () => {
      await respond(
        { statusCode: 401, message: 'Credenciales inválidas', error: 'Unauthorized' },
        401,
        'Unauthorized',
      );

      expect(summary()?.textContent?.trim()).toBe('Credenciales inválidas');
      expect(summary()?.getAttribute('role')).toBe('alert');
      expect(document.activeElement).toBe(summary());
      expect(TestBed.inject(SessionStore).hasToken()).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
      expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(
        false,
      );
    });

    it('shows an inactive account (403)', async () => {
      await respond(
        { statusCode: 403, message: 'La cuenta no está activa', error: 'Forbidden' },
        403,
        'Forbidden',
      );

      expect(summary()?.textContent?.trim()).toBe('La cuenta no está activa');
    });

    it('maps backend validation errors (400) to their fields', async () => {
      await respond(
        { statusCode: 400, message: ['email must be an email'], error: 'Bad Request' },
        400,
        'Bad Request',
      );

      expect(errorText('email')).toContain('El servidor rechazó este dato');
      expect(summary()?.textContent).toContain('Revise los campos marcados');
    });

    it('shows a general message on network errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      httpTesting.expectOne(LOGIN_URL).error(new ProgressEvent('error'));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(summary()?.textContent).toContain('No se pudo conectar con el servidor');
    });
  });
});

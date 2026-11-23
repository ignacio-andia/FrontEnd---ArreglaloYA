import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthResponse } from '../../../../core/auth/auth.models';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../../core/interceptors/auth.interceptor';
import { RegisterPageComponent } from './register-page.component';

const REGISTER_URL = apiUrl('auth', 'register');

const authResponse: AuthResponse = {
  accessToken: 'jwt-token',
  tokenType: 'Bearer',
  user: {
    id: '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f',
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    phone: null,
    status: 'ACTIVO',
    roles: ['CLIENTE'],
    createdAt: '2026-11-15T14:30:00.000Z',
    updatedAt: '2026-11-15T14:30:00.000Z',
  },
};

describe('RegisterPageComponent', () => {
  let fixture: ComponentFixture<RegisterPageComponent>;
  let element: HTMLElement;
  let httpTesting: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(RegisterPageComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  function input(id: string): HTMLInputElement {
    const found = element.querySelector<HTMLInputElement>(`#register-${id}`);
    if (!found) {
      throw new Error(`Input ${id} not found`);
    }
    return found;
  }

  function type(id: string, value: string): void {
    const field = input(id);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
  }

  function fillValidForm(phone = ''): void {
    type('firstName', '  Ana ');
    type('lastName', 'Pérez');
    type('email', ' ana@example.com ');
    type('password', 'Clave1234');
    type('phone', phone);
  }

  async function submit(): Promise<void> {
    element.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function errorText(id: string): string | null {
    return element.querySelector(`#register-${id}-error`)?.textContent?.trim() ?? null;
  }

  it('renders the five labelled fields with phone as optional', () => {
    for (const [id, label] of [
      ['firstName', 'Nombre'],
      ['lastName', 'Apellido'],
      ['email', 'Correo electrónico'],
      ['password', 'Contraseña'],
      ['phone', 'Teléfono'],
    ]) {
      expect(element.querySelector(`label[for="register-${id}"]`)?.textContent).toContain(label);
    }
    expect(input('phone').required).toBe(false);
    expect(input('password').type).toBe('password');
  });

  it('does not submit an invalid form and focuses the first invalid field', async () => {
    await submit();

    httpTesting.expectNone(REGISTER_URL);
    expect(errorText('firstName')).toBe('Ingrese su nombre.');
    expect(errorText('lastName')).toBe('Ingrese su apellido.');
    expect(errorText('email')).toBe('Ingrese su correo electrónico.');
    expect(errorText('password')).toBe('Ingrese una contraseña.');
    expect(errorText('phone')).toBeNull();
    expect(input('firstName').getAttribute('aria-invalid')).toBe('true');
    expect(input('firstName').getAttribute('aria-describedby')).toBe('register-firstName-error');
    expect(document.activeElement).toBe(input('firstName'));
  });

  it('shows the backend password and phone rules', () => {
    type('password', 'abcdefgh');
    type('phone', '7000-0000');
    fixture.detectChanges();

    expect(errorText('password')).toBe('Incluya al menos una letra y un número.');
    expect(errorText('phone')).toContain('entre 7 y 15 dígitos');
    expect(input('password').getAttribute('aria-describedby')).toBe(
      'register-password-hint register-password-error',
    );
  });

  it('sends the exact RegisterDto, stores the session and goes to the client area', async () => {
    fillValidForm();
    await submit();

    const req = httpTesting.expectOne(REGISTER_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      password: 'Clave1234',
    });
    req.flush(authResponse, { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/cliente');
  });

  it('omits a phone made only of spaces and never sends confirmPassword', async () => {
    fillValidForm('   ');
    await submit();

    const req = httpTesting.expectOne(REGISTER_URL);
    expect(Object.keys(req.request.body as object).sort()).toEqual([
      'email',
      'firstName',
      'lastName',
      'password',
    ]);
    req.flush(authResponse, { status: 201, statusText: 'Created' });
  });

  it('includes the phone when provided', async () => {
    fillValidForm(' +59170000000 ');
    await submit();

    const req = httpTesting.expectOne(REGISTER_URL);
    expect(req.request.body).toEqual(expect.objectContaining({ phone: '+59170000000' }));
    req.flush(authResponse, { status: 201, statusText: 'Created' });
  });

  it('disables the button while submitting and ignores repeated submits', async () => {
    fillValidForm();
    await submit();
    await submit();

    const button = element.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(button?.disabled).toBe(true);
    expect(button?.textContent?.trim()).toBe('Creando cuenta…');
    httpTesting.expectOne(REGISTER_URL).flush(authResponse, { status: 201, statusText: 'Created' });
  });

  it('marks the email when it is already registered (409)', async () => {
    fillValidForm();
    await submit();

    httpTesting
      .expectOne(REGISTER_URL)
      .flush(
        { statusCode: 409, message: 'El correo electrónico ya está registrado', error: 'Conflict' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(errorText('email')).toBe('El correo electrónico ya está registrado');
    expect(input('email').getAttribute('aria-invalid')).toBe('true');
    const alert = element.querySelector('#register-error-summary');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(document.activeElement).toBe(alert);
    expect(navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(SessionStore).hasToken()).toBe(false);
  });

  it('maps backend validation messages (400) to their fields', async () => {
    fillValidForm();
    await submit();

    httpTesting.expectOne(REGISTER_URL).flush(
      {
        statusCode: 400,
        message: ['email must be an email'],
        error: 'Bad Request',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(errorText('email')).toContain('El servidor rechazó este dato');
    expect(element.querySelector('#register-error-summary')?.textContent).toContain(
      'Revise los campos marcados',
    );
  });

  it('clears a server error when the field changes', async () => {
    fillValidForm();
    await submit();
    httpTesting
      .expectOne(REGISTER_URL)
      .flush(
        { statusCode: 409, message: 'El correo electrónico ya está registrado', error: 'Conflict' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    type('email', 'otra@example.com');
    fixture.detectChanges();

    expect(errorText('email')).toBeNull();
  });

  it('shows a general message on network errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fillValidForm();
    await submit();

    httpTesting.expectOne(REGISTER_URL).error(new ProgressEvent('error'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.querySelector('#register-error-summary')?.textContent).toContain(
      'No se pudo conectar con el servidor',
    );
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  });

  it('toggles the password visibility', () => {
    const toggle = element.querySelector<HTMLButtonElement>('.field__toggle');

    toggle?.click();
    fixture.detectChanges();

    expect(input('password').type).toBe('text');
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
  });
});

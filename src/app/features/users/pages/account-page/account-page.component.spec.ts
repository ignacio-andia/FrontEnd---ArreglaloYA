import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { User } from '../../../../core/auth/auth.models';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../../core/interceptors/auth.interceptor';
import { AccountPageComponent } from './account-page.component';

const USER_ID = '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f';
const ME_URL = apiUrl('auth', 'me');
const PATCH_URL = apiUrl('users', USER_ID);

function account(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    phone: null,
    status: 'ACTIVO',
    roles: ['CLIENTE'],
    createdAt: '2026-11-15T14:30:00.000Z',
    updatedAt: '2026-11-15T14:30:00.000Z',
    ...overrides,
  };
}

describe('AccountPageComponent', () => {
  let fixture: ComponentFixture<AccountPageComponent>;
  let element: HTMLElement;
  let httpTesting: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    session = TestBed.inject(SessionStore);
    session.setSession({ accessToken: 'jwt-token', tokenType: 'Bearer', user: account() });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AccountPageComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  function pending(url: string): Promise<TestRequest> {
    return vi.waitFor(() => httpTesting.expectOne(url));
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function load(user: User = account()): Promise<void> {
    (await pending(ME_URL)).flush(user);
    await settle();
  }

  function input(field: 'firstName' | 'lastName' | 'phone'): HTMLInputElement {
    const found = element.querySelector<HTMLInputElement>(`#account-${field}`);
    if (!found) {
      throw new Error(`${field} not found`);
    }
    return found;
  }

  function type(field: 'firstName' | 'lastName' | 'phone', value: string): void {
    input(field).value = value;
    input(field).dispatchEvent(new Event('input'));
    input(field).dispatchEvent(new Event('blur'));
  }

  async function submit(): Promise<void> {
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function errorText(field: string): string | null {
    return element.querySelector(`#account-${field}-error`)?.textContent?.trim() ?? null;
  }

  function status(): string {
    return element.querySelector('.account__status')?.textContent?.trim() ?? '';
  }

  it('shows a loading state while the account is requested from /auth/me', async () => {
    const req = await pending(ME_URL);
    fixture.detectChanges();

    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Cargando los datos de su cuenta',
    );
    expect(element.querySelector('form')).toBeNull();

    req.flush(account());
    await settle();
    expect(element.querySelector('form')).not.toBeNull();
  });

  it('shows the current data, with the email as read-only', async () => {
    await load(account({ firstName: 'Ana', lastName: 'Pérez', phone: '+59170000000' }));

    expect(element.querySelector('.account__readonly dd')?.textContent).toBe('ana@example.com');
    expect(element.querySelector('input[type="email"]')).toBeNull();
    expect(input('firstName').value).toBe('Ana');
    expect(input('lastName').value).toBe('Pérez');
    expect(input('phone').value).toBe('+59170000000');
  });

  it('loads an empty phone field when the account has no phone', async () => {
    await load(account({ phone: null }));

    expect(input('phone').value).toBe('');
  });

  it('registers the phone, sends only that change and updates SessionStore', async () => {
    await load();
    type('phone', ' 70000000 ');
    await submit();

    const req = httpTesting.expectOne(PATCH_URL);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ phone: '70000000' });
    req.flush(account({ phone: '70000000', updatedAt: '2026-11-16T10:00:00.000Z' }));
    await settle();

    expect(session.user()?.phone).toBe('70000000');
    expect(session.token()).toBe('jwt-token');
    expect(status()).toBe('Sus datos se actualizaron correctamente.');
    expect(input('phone').value).toBe('70000000');
  });

  it('updates the names (trimmed) and reflects them in the session', async () => {
    await load();
    type('firstName', '  Ana María ');
    await submit();

    const req = httpTesting.expectOne(PATCH_URL);
    expect(req.request.body).toEqual({ firstName: 'Ana María' });
    req.flush(account({ firstName: 'Ana María' }));
    await settle();

    expect(session.user()?.firstName).toBe('Ana María');
  });

  it('sends null to delete an existing phone', async () => {
    await load(account({ phone: '70000000' }));
    type('phone', '   ');
    await submit();

    const req = httpTesting.expectOne(PATCH_URL);
    expect(req.request.body).toEqual({ phone: null });
    req.flush(account({ phone: null }));
    await settle();

    expect(session.user()?.phone).toBeNull();
  });

  it('does not call the API when nothing changed', async () => {
    await load(account({ phone: '70000000' }));
    await submit();

    httpTesting.expectNone(PATCH_URL);
    expect(status()).toBe('No hay cambios para guardar.');
  });

  it('clears the previous notice when the user edits a field', async () => {
    await load();
    await submit();
    expect(status()).toBe('No hay cambios para guardar.');

    type('phone', '7');
    fixture.detectChanges();

    expect(status()).toBe('');
  });

  it('validates the fields without calling the API', async () => {
    await load();
    type('firstName', '   ');
    type('lastName', 'a'.repeat(101));
    type('phone', '7000-0000');
    await submit();

    httpTesting.expectNone(PATCH_URL);
    expect(errorText('firstName')).toBe('Ingrese su nombre.');
    expect(errorText('lastName')).toBe('Use como máximo 100 caracteres.');
    expect(errorText('phone')).toContain('entre 7 y 15 dígitos');
    expect(input('firstName').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input('firstName'));
  });

  it('disables the button while saving and ignores a second submit', async () => {
    await load();
    type('phone', '70000000');
    await submit();
    await submit();

    const button = element.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(button?.disabled).toBe(true);
    expect(button?.textContent?.trim()).toBe('Guardando…');
    httpTesting.expectOne(PATCH_URL).flush(account({ phone: '70000000' }));
    await settle();
    expect(button?.disabled).toBe(false);
  });

  it('maps a backend phone validation error (400) to the field', async () => {
    await load();
    type('phone', '70000000');
    await submit();

    httpTesting.expectOne(PATCH_URL).flush(
      {
        statusCode: 400,
        message: ['phone debe tener entre 7 y 15 dígitos, opcionalmente precedidos de +'],
        error: 'Bad Request',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await settle();

    expect(errorText('phone')).toContain('El servidor rechazó este dato');
    const alert = element.querySelector('#account-error-summary');
    expect(alert?.textContent).toContain('Revise los campos marcados');
    expect(document.activeElement).toBe(alert);
    expect(session.user()?.phone).toBeNull();
  });

  it('shows other server errors without changing the session', async () => {
    await load();
    type('phone', '70000000');
    await submit();

    httpTesting.expectOne(PATCH_URL).flush(
      {
        statusCode: 403,
        message: 'No tiene permisos para acceder a este usuario',
        error: 'Forbidden',
      },
      { status: 403, statusText: 'Forbidden' },
    );
    await settle();

    expect(element.querySelector('#account-error-summary')?.textContent).toContain(
      'No tiene permisos para acceder a este usuario',
    );
    expect(session.user()?.phone).toBeNull();
    expect(session.isAuthenticated()).toBe(true);
  });

  it('shows a load error with retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    (await pending(ME_URL)).error(new ProgressEvent('error'));
    await settle();

    const alert = element.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No se pudo conectar con el servidor');

    alert?.querySelector('button')?.click();
    fixture.detectChanges();
    await load();
    expect(element.querySelector('form')).not.toBeNull();
  });
});

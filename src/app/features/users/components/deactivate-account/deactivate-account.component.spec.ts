import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { DeactivateAccountComponent } from './deactivate-account.component';

const USER_ID = '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f';
const STATUS_URL = apiUrl('users', USER_ID, 'status');

describe('DeactivateAccountComponent', () => {
  let fixture: ComponentFixture<DeactivateAccountComponent>;
  let element: HTMLElement;
  let httpTesting: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    session = TestBed.inject(SessionStore);
    session.setSession({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      user: {
        id: USER_ID,
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@example.com',
        phone: null,
        status: 'ACTIVO',
        roles: ['CLIENTE'],
        createdAt: '2026-11-15T14:30:00.000Z',
        updatedAt: '2026-11-15T14:30:00.000Z',
      },
    });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DeactivateAccountComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
  });

  function click(selector: string): void {
    element.querySelector<HTMLButtonElement>(selector)?.click();
    fixture.detectChanges();
  }

  function dialogOpen(): boolean {
    return element.querySelector('dialog')?.hasAttribute('open') ?? false;
  }

  it('asks for confirmation and sends nothing when cancelled', () => {
    click('.danger__button');
    expect(dialogOpen()).toBe(true);

    click('.dialog__cancel');

    expect(dialogOpen()).toBe(false);
    httpTesting.expectNone(STATUS_URL);
    expect(session.isAuthenticated()).toBe(true);
  });

  it('closes the confirmation with Escape', () => {
    click('.danger__button');

    element
      .querySelector('dialog')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(dialogOpen()).toBe(false);
    httpTesting.expectNone(STATUS_URL);
  });

  it('deactivates the own account, closes the session and goes to the login', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    click('.danger__button');
    click('.dialog__confirm');

    const request = httpTesting.expectOne(STATUS_URL);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'INACTIVO' });
    request.flush({});

    expect(session.token()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/auth/login', {
      state: { loginNotice: 'account-deactivated' },
    });
  });

  it('keeps the session and shows the backend message on 409', () => {
    click('.danger__button');
    click('.dialog__confirm');

    httpTesting.expectOne(STATUS_URL).flush(
      {
        statusCode: 409,
        message: 'No se puede desactivar al único administrador activo',
        error: 'Conflict',
      },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(dialogOpen()).toBe(false);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('único administrador');
    expect(session.isAuthenticated()).toBe(true);
  });
});

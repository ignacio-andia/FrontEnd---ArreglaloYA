import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../../core/interceptors/auth.interceptor';
import { RoleName } from '../../../../core/models/role.model';
import { WorkerEligibility } from '../../models/worker-profile.model';
import { userWithRoles, workerProfile } from '../../testing/worker-profile.fixtures';
import { MyWorkerProfilePageComponent } from './my-worker-profile-page.component';

const PROFILE_URL = apiUrl('worker-profile', 'me');
const ELIGIBILITY_URL = apiUrl('worker-profile', 'me', 'eligibility');

const notEligible: WorkerEligibility = {
  eligible: false,
  status: 'BORRADOR',
  message: 'Su perfil de trabajador aún no fue enviado a revisión.',
  reason: null,
};

describe('MyWorkerProfilePageComponent', () => {
  let fixture: ComponentFixture<MyWorkerProfilePageComponent>;
  let element: HTMLElement;
  let httpTesting: HttpTestingController;

  function render(roles: RoleName[] = ['CLIENTE', 'TRABAJADOR']): void {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    TestBed.inject(SessionStore).setSession({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      user: userWithRoles(roles),
    });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyWorkerProfilePageComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

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

  it('shows the profile and the effective eligibility reported by the backend', async () => {
    render();
    (await pending(PROFILE_URL)).flush(workerProfile());
    (await pending(ELIGIBILITY_URL)).flush(notEligible);
    await settle();

    expect(element.querySelector('.status-badge')?.textContent).toBe('Borrador');
    expect(element.querySelector('.my-profile__eligibility-message')?.textContent?.trim()).toBe(
      'Su perfil de trabajador aún no fue enviado a revisión.',
    );
    expect(element.querySelector('.my-profile__eligibility-message--enabled')).toBeNull();
  });

  it('shows the reason registered by the administrator', async () => {
    render();
    (await pending(PROFILE_URL)).flush(workerProfile({ status: 'OBSERVADO' }));
    (await pending(ELIGIBILITY_URL)).flush({
      ...notEligible,
      status: 'OBSERVADO',
      message: 'Su perfil de trabajador tiene observaciones.',
      reason: 'Falta el certificado de antecedentes.',
    } satisfies WorkerEligibility);
    await settle();

    expect(element.querySelector('.my-profile__reason')?.textContent).toBe(
      'Motivo: Falta el certificado de antecedentes.',
    );
  });

  it('offers to create the profile when the account has the role but no profile (404)', async () => {
    render();
    (await pending(PROFILE_URL)).flush(
      { statusCode: 404, message: 'Aún no tiene un perfil de trabajador', error: 'Not Found' },
      { status: 404, statusText: 'Not Found' },
    );
    (await pending(ELIGIBILITY_URL)).flush({ ...notEligible, status: null });
    await settle();

    expect(element.textContent).toContain('Aún no tiene un perfil de trabajador.');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/cliente/ofrecer-servicios');
  });

  it('shows an error with retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render();
    (await pending(PROFILE_URL)).error(new ProgressEvent('error'));
    (await pending(ELIGIBILITY_URL)).flush(notEligible);
    await settle();

    const alert = element.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No se pudo conectar con el servidor');

    alert?.querySelector('button')?.click();
    fixture.detectChanges();
    (await pending(PROFILE_URL)).flush(workerProfile());
    (await pending(ELIGIBILITY_URL)).flush(notEligible);
    await settle();

    expect(element.querySelector('app-worker-profile-summary')).not.toBeNull();
  });
});

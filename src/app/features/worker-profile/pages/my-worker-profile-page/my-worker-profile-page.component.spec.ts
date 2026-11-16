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
import { WorkerEligibility, WorkerProfile, WorkerStatus } from '../../models/worker-profile.model';
import {
  CATEGORIES,
  ZONE,
  userWithRoles,
  workerProfile,
} from '../../testing/worker-profile.fixtures';
import { MyWorkerProfilePageComponent } from './my-worker-profile-page.component';

const PROFILE_URL = apiUrl('worker-profile', 'me');
const ELIGIBILITY_URL = apiUrl('worker-profile', 'me', 'eligibility');
const STATUS_URL = apiUrl('worker-profile', 'me', 'status');
const DOCUMENTS_URL = apiUrl('worker-profile', 'me', 'documents');
const ZONES_URL = apiUrl('catalogs', 'zones');
const CATEGORIES_URL = apiUrl('catalogs', 'categories');

const notEligible: WorkerEligibility = {
  eligible: false,
  status: 'BORRADOR',
  message: 'Su perfil de trabajador aún no fue enviado a revisión.',
  reason: null,
};

function statusOf(profile: WorkerProfile, reason: string | null = null): WorkerStatus {
  return {
    status: profile.status,
    statusReason: reason,
    history: [
      {
        id: 'h1',
        fromStatus: null,
        toStatus: 'BORRADOR',
        reason: null,
        createdAt: '2026-11-15T14:30:00.000Z',
        changedBy: 'TRABAJADOR',
      },
    ],
  };
}

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

  /** Responde todas las consultas que hace la página con un perfil existente. */
  async function load(
    profile: WorkerProfile,
    eligibility: WorkerEligibility = notEligible,
    reason: string | null = null,
  ): Promise<void> {
    (await pending(PROFILE_URL)).flush(profile);
    (await pending(ELIGIBILITY_URL)).flush(eligibility);
    (await pending(STATUS_URL)).flush(statusOf(profile, reason));
    (await pending(DOCUMENTS_URL)).flush([]);
    if (profile.canEdit) {
      (await pending(ZONES_URL)).flush([ZONE]);
      (await pending(CATEGORIES_URL)).flush(CATEGORIES);
    }
    await settle();
  }

  it('shows the profile, its history and the eligibility reported by the backend', async () => {
    render();
    await load(workerProfile());

    expect(element.querySelector('.status-badge')?.textContent).toBe('Borrador');
    expect(element.querySelector('.my-profile__eligibility-message')?.textContent?.trim()).toBe(
      'Su perfil de trabajador aún no fue enviado a revisión.',
    );
    expect(element.querySelector('.my-profile__eligibility-message--enabled')).toBeNull();
    expect(element.querySelector('.my-profile__history')?.textContent).toContain('Borrador');
  });

  it('shows every editable section for a BORRADOR profile', async () => {
    render();
    await load(workerProfile({ status: 'BORRADOR', canEdit: true }));

    expect(element.querySelector('app-profile-details-form')).not.toBeNull();
    expect(element.querySelector('app-specialties-form')).not.toBeNull();
    expect(element.querySelector('app-schedules-form')).not.toBeNull();
    expect(element.querySelector('app-worker-documents-panel app-file-dropzone')).not.toBeNull();
    expect(element.querySelector('app-submit-review')).not.toBeNull();
  });

  it('keeps a PENDIENTE profile read-only except for the schedules', async () => {
    render();
    await load(
      workerProfile({
        status: 'PENDIENTE',
        canEdit: false,
        canSubmit: false,
        pendingRequirements: [],
      }),
      { ...notEligible, status: 'PENDIENTE', message: 'Su perfil está pendiente de revisión.' },
    );

    expect(element.querySelector('app-profile-details-form')).toBeNull();
    expect(element.querySelector('app-specialties-form')).toBeNull();
    expect(element.querySelector('app-submit-review')).toBeNull();
    expect(element.querySelector('app-schedules-form')).not.toBeNull();
    expect(element.querySelector('app-file-dropzone')).toBeNull();
    expect(element.textContent).toContain('Con el perfil en estado Pendiente de revisión');
  });

  it('shows the reason registered by the administrator', async () => {
    render();
    await load(workerProfile({ status: 'OBSERVADO' }), {
      ...notEligible,
      status: 'OBSERVADO',
      message: 'Su perfil de trabajador tiene observaciones.',
      reason: 'Falta el certificado de antecedentes.',
    });

    expect(element.querySelector('.my-profile__reason')?.textContent).toBe(
      'Motivo: Falta el certificado de antecedentes.',
    );
  });

  it('submits the profile for review and shows that it is not approved yet', async () => {
    render();
    await load(workerProfile({ canSubmit: true, pendingRequirements: [] }));

    const submitButton = Array.from(element.querySelectorAll('app-submit-review button')).find(
      (button) => button.textContent?.includes('Enviar a revisión'),
    ) as HTMLButtonElement;
    submitButton.click();
    fixture.detectChanges();
    (
      Array.from(element.querySelectorAll('app-submit-review button')).find((button) =>
        button.textContent?.includes('Confirmar envío'),
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const submit = await pending(apiUrl('worker-profile', 'me', 'submit'));
    expect(submit.request.method).toBe('POST');
    submit.flush(
      workerProfile({
        status: 'PENDIENTE',
        canEdit: false,
        canSubmit: false,
        pendingRequirements: [],
      }),
    );
    (await pending(STATUS_URL)).flush(statusOf(workerProfile({ status: 'PENDIENTE' })));
    (await pending(ELIGIBILITY_URL)).flush({
      ...notEligible,
      status: 'PENDIENTE',
      message: 'Su perfil de trabajador está pendiente de revisión.',
    });
    await settle();

    const message = element.querySelector('#my-profile-submitted')?.textContent;
    expect(message).toContain('Pendiente de revisión');
    expect(message).toContain('Todavía no está aprobado');
    expect(element.querySelector('.status-badge')?.textContent).toBe('Pendiente de revisión');
    expect(element.querySelector('app-submit-review')).toBeNull();
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
    await load(workerProfile({ canEdit: false }));

    expect(element.querySelector('app-worker-profile-summary')).not.toBeNull();
  });
});

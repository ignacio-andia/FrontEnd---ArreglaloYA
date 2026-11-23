import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionStore } from '../../../core/auth/session.store';
import { apiUrl } from '../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { WorkerProfile } from '../models/worker-profile.model';
import { CATEGORIES, ZONE, userWithRoles, workerProfile } from '../testing/worker-profile.fixtures';
import { ProfileDetailsFormComponent } from './profile-details-form/profile-details-form.component';
import { SchedulesFormComponent } from './schedules-form/schedules-form.component';
import { SpecialtiesFormComponent } from './specialties-form/specialties-form.component';
import { SubmitReviewComponent } from './submit-review/submit-review.component';

const OTHER_ZONE = {
  id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d',
  name: 'Zona Sur',
  description: null,
};

function configure(): HttpTestingController {
  sessionStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  TestBed.inject(SessionStore).setSession({
    accessToken: 'jwt-token',
    tokenType: 'Bearer',
    user: userWithRoles(['CLIENTE', 'TRABAJADOR']),
  });
  return TestBed.inject(HttpTestingController);
}

function button(element: HTMLElement, text: string): HTMLButtonElement {
  const found = Array.from(element.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!found) {
    throw new Error(`${text} not found`);
  }
  return found;
}

function setValue(element: HTMLElement, selector: string, value: string): void {
  const field = element.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    selector,
  );
  if (!field) {
    throw new Error(`${selector} not found`);
  }
  field.value = value;
  field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
  field.dispatchEvent(new Event('blur'));
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await fixture.whenStable();
  fixture.detectChanges();
}

function pending(http: HttpTestingController, url: string): Promise<TestRequest> {
  return vi.waitFor(() => http.expectOne(url));
}

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('ProfileDetailsFormComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ProfileDetailsFormComponent>;
  let element: HTMLElement;
  let saved: WorkerProfile[];

  function render(profile: WorkerProfile): void {
    http = configure();
    fixture = TestBed.createComponent(ProfileDetailsFormComponent);
    fixture.componentRef.setInput('profile', profile);
    fixture.componentRef.setInput('zones', [ZONE, OTHER_ZONE]);
    element = fixture.nativeElement as HTMLElement;
    saved = [];
    fixture.componentInstance.saved.subscribe((value) => saved.push(value));
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('sends only the changed fields and emits the saved profile', async () => {
    render(workerProfile({ yearsOfExperience: 5, description: 'Antes' }));
    setValue(element, '#details-years', '8');
    setValue(element, '#details-description', '   ');
    setValue(element, '#details-zone', OTHER_ZONE.id);
    button(element, 'Guardar datos').click();
    fixture.detectChanges();

    const req = http.expectOne(apiUrl('worker-profile', 'me'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      yearsOfExperience: 8,
      description: null,
      zoneId: OTHER_ZONE.id,
    });
    req.flush(workerProfile({ yearsOfExperience: 8 }));
    await settle(fixture);

    expect(saved).toHaveLength(1);
    expect(element.textContent).toContain('Los datos del perfil se guardaron.');
  });

  it('does not call the API without changes', () => {
    render(workerProfile());
    button(element, 'Guardar datos').click();
    fixture.detectChanges();

    http.expectNone(apiUrl('worker-profile', 'me'));
    expect(element.textContent).toContain('No hay cambios para guardar.');
  });

  it('keeps the zone fixed outside BORRADOR and never sends it', async () => {
    render(workerProfile({ status: 'OBSERVADO' }));

    expect(element.querySelector('#details-zone')).toBeNull();
    expect(element.textContent).toContain('La zona es fija');

    setValue(element, '#details-years', '9');
    button(element, 'Guardar datos').click();
    fixture.detectChanges();
    const req = http.expectOne(apiUrl('worker-profile', 'me'));
    expect(req.request.body).toEqual({ yearsOfExperience: 9 });
    req.flush(
      {
        statusCode: 409,
        message: 'No se puede modificar el perfil en estado PENDIENTE',
        error: 'Conflict',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await settle(fixture);

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No se puede modificar el perfil en estado PENDIENTE',
    );
  });

  it('validates the experience before calling the API', () => {
    render(workerProfile());
    setValue(element, '#details-years', '71');
    button(element, 'Guardar datos').click();
    fixture.detectChanges();

    http.expectNone(apiUrl('worker-profile', 'me'));
    expect(element.textContent).toContain('Ingrese un número entero entre 0 y 70.');
  });
});

describe('SpecialtiesFormComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<SpecialtiesFormComponent>;
  let element: HTMLElement;

  function render(profile: WorkerProfile): void {
    http = configure();
    fixture = TestBed.createComponent(SpecialtiesFormComponent);
    fixture.componentRef.setInput('profile', profile);
    fixture.componentRef.setInput('categories', CATEGORIES);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  function checkboxes(): HTMLInputElement[] {
    return Array.from(element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  }

  it('starts with the current specialties and replaces the whole set', async () => {
    render(workerProfile());
    expect(checkboxes().map((box) => box.checked)).toEqual([false, true]);

    checkboxes()[0].click();
    fixture.detectChanges();
    button(element, 'Guardar especialidades').click();
    fixture.detectChanges();

    const req = http.expectOne(apiUrl('worker-profile', 'me', 'specialties'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ categoryIds: [CATEGORIES[1].id, CATEGORIES[0].id] });
    req.flush(workerProfile());
    await settle(fixture);
    expect(element.textContent).toContain('Las especialidades se guardaron.');
  });

  it('requires at least one specialty', () => {
    render(workerProfile());
    checkboxes()[1].click();
    fixture.detectChanges();
    button(element, 'Guardar especialidades').click();
    fixture.detectChanges();

    http.expectNone(apiUrl('worker-profile', 'me', 'specialties'));
    expect(element.textContent).toContain('Seleccione al menos una especialidad.');
  });

  it('warns about deactivated specialties that will be removed', () => {
    render(
      workerProfile({
        specialties: [
          { id: CATEGORIES[1].id, name: CATEGORIES[1].name, isActive: true },
          { id: 'inactiva', name: 'Jardinería', isActive: false },
        ],
      }),
    );

    expect(element.textContent).toContain('se quitarán al guardar: Jardinería');
  });
});

describe('SchedulesFormComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<SchedulesFormComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    http = configure();
    fixture = TestBed.createComponent(SchedulesFormComponent);
    fixture.componentRef.setInput(
      'profile',
      workerProfile({
        status: 'PENDIENTE',
        canEdit: false,
        schedules: [
          { id: 's1', dayOfWeek: 'LUNES', startTime: '08:00', endTime: '12:00', isActive: true },
        ],
      }),
    );
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('loads the current schedules and replaces them in any status', async () => {
    expect(element.querySelector<HTMLSelectElement>('#profile-schedule-day-0')?.value).toBe(
      'LUNES',
    );

    button(element, 'Agregar horario').click();
    fixture.detectChanges();
    setValue(element, '#profile-schedule-day-1', 'MARTES');
    setValue(element, '#profile-schedule-start-1', '14:00');
    setValue(element, '#profile-schedule-end-1', '18:00');
    button(element, 'Guardar horarios').click();
    fixture.detectChanges();

    const req = http.expectOne(apiUrl('worker-profile', 'me', 'schedules'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      schedules: [
        { dayOfWeek: 'LUNES', startTime: '08:00', endTime: '12:00', isActive: true },
        { dayOfWeek: 'MARTES', startTime: '14:00', endTime: '18:00', isActive: true },
      ],
    });
    req.flush(workerProfile());
    await settle(fixture);
    expect(element.textContent).toContain('Los horarios se guardaron.');
  });

  it('does not send overlapping schedules', () => {
    button(element, 'Agregar horario').click();
    fixture.detectChanges();
    setValue(element, '#profile-schedule-day-1', 'LUNES');
    setValue(element, '#profile-schedule-start-1', '11:00');
    setValue(element, '#profile-schedule-end-1', '13:00');
    button(element, 'Guardar horarios').click();
    fixture.detectChanges();

    http.expectNone(apiUrl('worker-profile', 'me', 'schedules'));
    expect(element.textContent).toContain('se superpone con 08:00-12:00');
  });

  it('shows the backend schedule errors', async () => {
    button(element, 'Guardar horarios').click();
    fixture.detectChanges();

    (await pending(http, apiUrl('worker-profile', 'me', 'schedules'))).flush(
      {
        statusCode: 400,
        message: ['Horario 1 (LUNES): la hora de fin debe ser posterior a la de inicio'],
        error: 'Bad Request',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await settle(fixture);

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Horario 1 (LUNES)');
  });
});

describe('SubmitReviewComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<SubmitReviewComponent>;
  let element: HTMLElement;
  let submitted: WorkerProfile[];

  function render(profile: WorkerProfile): void {
    http = configure();
    fixture = TestBed.createComponent(SubmitReviewComponent);
    fixture.componentRef.setInput('profile', profile);
    element = fixture.nativeElement as HTMLElement;
    submitted = [];
    fixture.componentInstance.submitted.subscribe((value) => submitted.push(value));
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('lists the pending requirements from the backend and disables the submission', () => {
    render(workerProfile());

    expect(element.textContent).toContain('Registre un teléfono de contacto en su cuenta');
    const submit = button(element, 'Enviar a revisión');
    expect(submit.disabled).toBe(true);
    expect(submit.getAttribute('aria-describedby')).toBe('submit-pending');
  });

  it('explains that a SUSPENDIDO profile cannot be submitted (canSubmit false, no requirements)', () => {
    render(workerProfile({ status: 'SUSPENDIDO', canSubmit: false, pendingRequirements: [] }));

    const submit = button(element, 'Enviar a revisión');
    expect(submit.disabled).toBe(true);
    expect(submit.getAttribute('aria-describedby')).toBe('submit-pending');
    expect(element.querySelector('#submit-pending')?.textContent?.trim()).toBe(
      'Con el perfil en estado Suspendido no se puede enviar a revisión.',
    );
  });

  it('lets a RECHAZADO profile be submitted again when the backend allows it', async () => {
    render(workerProfile({ status: 'RECHAZADO', canSubmit: true, pendingRequirements: [] }));

    expect(element.querySelector('#submit-pending')).toBeNull();
    button(element, 'Enviar a revisión').click();
    fixture.detectChanges();
    button(element, 'Confirmar envío').click();
    fixture.detectChanges();
    http
      .expectOne(apiUrl('worker-profile', 'me', 'submit'))
      .flush(workerProfile({ status: 'PENDIENTE', canEdit: false, canSubmit: false }));
    await settle(fixture);

    expect(submitted.map((profile) => profile.status)).toEqual(['PENDIENTE']);
  });

  it('asks for confirmation before submitting and emits the PENDIENTE profile', async () => {
    render(workerProfile({ canSubmit: true, pendingRequirements: [] }));

    button(element, 'Enviar a revisión').click();
    fixture.detectChanges();
    http.expectNone(apiUrl('worker-profile', 'me', 'submit'));

    button(element, 'Confirmar envío').click();
    fixture.detectChanges();
    http
      .expectOne(apiUrl('worker-profile', 'me', 'submit'))
      .flush(workerProfile({ status: 'PENDIENTE', canEdit: false, canSubmit: false }));
    await settle(fixture);

    expect(submitted.map((profile) => profile.status)).toEqual(['PENDIENTE']);
  });

  it('shows the missing requirements returned with a 400 and a 409 conflict', async () => {
    render(workerProfile({ canSubmit: true, pendingRequirements: [] }));
    button(element, 'Enviar a revisión').click();
    fixture.detectChanges();
    button(element, 'Confirmar envío').click();
    fixture.detectChanges();

    http.expectOne(apiUrl('worker-profile', 'me', 'submit')).flush(
      {
        statusCode: 400,
        message: ['Registre un teléfono de contacto en su cuenta'],
        error: 'Bad Request',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await settle(fixture);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Registre un teléfono de contacto en su cuenta',
    );

    button(element, 'Enviar a revisión').click();
    fixture.detectChanges();
    button(element, 'Confirmar envío').click();
    fixture.detectChanges();
    http.expectOne(apiUrl('worker-profile', 'me', 'submit')).flush(
      {
        statusCode: 409,
        message: 'No se puede enviar a revisión un perfil en estado PENDIENTE',
        error: 'Conflict',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await settle(fixture);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No se puede enviar a revisión un perfil en estado PENDIENTE',
    );
    expect(submitted).toHaveLength(0);
  });
});

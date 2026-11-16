import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../../core/interceptors/auth.interceptor';
import { RoleName } from '../../../../core/models/role.model';
import { CatalogOption } from '../../../catalogs/models/catalog.model';
import {
  CATEGORIES,
  ZONE,
  userWithRoles,
  workerProfile,
} from '../../testing/worker-profile.fixtures';
import { BecomeWorkerPageComponent } from './become-worker-page.component';

const ZONES_URL = apiUrl('catalogs', 'zones');
const CATEGORIES_URL = apiUrl('catalogs', 'categories');
const CREATE_URL = apiUrl('worker-profile');
const OWN_PROFILE_URL = apiUrl('worker-profile', 'me');
const ME_URL = apiUrl('auth', 'me');

describe('BecomeWorkerPageComponent', () => {
  let fixture: ComponentFixture<BecomeWorkerPageComponent>;
  let element: HTMLElement;
  let httpTesting: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  function render(roles: RoleName[]): void {
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
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(BecomeWorkerPageComponent);
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

  async function loadCatalogs(
    zones: CatalogOption[] = [ZONE],
    categories: CatalogOption[] = CATEGORIES,
  ): Promise<void> {
    (await pending(ZONES_URL)).flush(zones);
    (await pending(CATEGORIES_URL)).flush(categories);
    await settle();
  }

  function setValue(selector: string, value: string): void {
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

  function checkCategory(index: number): void {
    element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[index]?.click();
  }

  function submitButton(): HTMLButtonElement | null {
    return element.querySelector<HTMLButtonElement>('button[type="submit"]');
  }

  async function submit(): Promise<void> {
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function fillValidForm(): Promise<void> {
    await loadCatalogs();
    setValue('#worker-yearsOfExperience', '5');
    setValue('#worker-zoneId', ZONE.id);
    checkCategory(0);
    checkCategory(1);
    setValue('#worker-description', '  Instalaciones sanitarias  ');
    fixture.detectChanges();
  }

  function errorText(field: string): string | null {
    return element.querySelector(`#worker-${field}-error`)?.textContent?.trim() ?? null;
  }

  describe('client without the TRABAJADOR role (no profile yet)', () => {
    beforeEach(() => render(['CLIENTE']));

    it('shows the creation form with the real zones and categories, without GET /me', async () => {
      await loadCatalogs();

      httpTesting.expectNone(OWN_PROFILE_URL);
      expect(element.querySelector('h1')?.textContent).toBe('Quiero ofrecer mis servicios');
      const options = Array.from(element.querySelectorAll('#worker-zoneId option')).map((option) =>
        option.textContent?.trim(),
      );
      expect(options).toEqual(['Seleccione una zona', 'Zona Norte']);
      const labels = Array.from(element.querySelectorAll('.field__check')).map((label) =>
        label.textContent?.trim(),
      );
      expect(labels).toEqual(['Electricidad', 'Plomería']);
      expect(submitButton()?.disabled).toBe(false);
    });

    it('blocks the form when there are no active zones', async () => {
      await loadCatalogs([], CATEGORIES);

      expect(element.querySelector('#worker-zoneId')).toBeNull();
      expect(element.querySelector('#worker-no-zones')?.textContent).toContain(
        'no hay zonas de trabajo habilitadas',
      );
      expect(submitButton()?.disabled).toBe(true);
      expect(submitButton()?.getAttribute('aria-describedby')).toBe('worker-submit-blocked');

      await submit();
      httpTesting.expectNone(CREATE_URL);
    });

    it('blocks the form when there are no active categories', async () => {
      await loadCatalogs([ZONE], []);

      expect(element.textContent).toContain('no hay especialidades habilitadas');
      expect(submitButton()?.disabled).toBe(true);
    });

    it('validates the required fields without calling the API', async () => {
      await loadCatalogs();
      await submit();

      httpTesting.expectNone(CREATE_URL);
      expect(errorText('yearsOfExperience')).toBe('Ingrese sus años de experiencia.');
      expect(errorText('zoneId')).toBe('Seleccione su zona de trabajo.');
      expect(errorText('categoryIds')).toBe('Seleccione al menos una especialidad.');
      expect(errorText('description')).toBeNull();
      expect(document.activeElement?.id).toBe('worker-yearsOfExperience');
    });

    it.each(['71', '-1', '2.5'])('rejects %s years of experience', async (years) => {
      await loadCatalogs();
      setValue('#worker-yearsOfExperience', years);
      fixture.detectChanges();

      expect(errorText('yearsOfExperience')).toBe('Ingrese un número entero entre 0 y 70.');
    });

    it('limits the description to 1000 characters', async () => {
      await loadCatalogs();
      setValue('#worker-description', 'a'.repeat(1001));
      fixture.detectChanges();

      expect(errorText('description')).toBe('Use como máximo 1000 caracteres.');
    });

    it('creates the profile, confirms the TRABAJADOR role and opens the worker area', async () => {
      await fillValidForm();
      await submit();

      const create = httpTesting.expectOne(CREATE_URL);
      expect(create.request.body).toEqual({
        yearsOfExperience: 5,
        zoneId: ZONE.id,
        categoryIds: [CATEGORIES[0].id, CATEGORIES[1].id],
        description: 'Instalaciones sanitarias',
      });
      create.flush(workerProfile(), { status: 201, statusText: 'Created' });

      (await pending(ME_URL)).flush(userWithRoles(['CLIENTE', 'TRABAJADOR']));
      await settle();

      expect(TestBed.inject(SessionStore).user()?.roles).toEqual(['CLIENTE', 'TRABAJADOR']);
      expect(navigate).toHaveBeenCalledWith('/trabajador/perfil');
    });

    it('does not assume the role when /auth/me does not confirm it', async () => {
      await fillValidForm();
      await submit();

      httpTesting
        .expectOne(CREATE_URL)
        .flush(workerProfile(), { status: 201, statusText: 'Created' });
      (await pending(ME_URL)).flush(userWithRoles(['CLIENTE']));
      await settle();

      expect(navigate).not.toHaveBeenCalled();
      expect(element.textContent).toContain('no se pudo actualizar su sesión');
      expect(element.querySelector('app-worker-profile-summary')).not.toBeNull();
    });

    it('disables the button while creating the profile', async () => {
      await fillValidForm();
      await submit();
      fixture.detectChanges();

      expect(submitButton()?.disabled).toBe(true);
      expect(submitButton()?.textContent?.trim()).toBe('Creando perfil…');
      httpTesting
        .expectOne(CREATE_URL)
        .flush(workerProfile(), { status: 201, statusText: 'Created' });
      (await pending(ME_URL)).flush(userWithRoles(['CLIENTE', 'TRABAJADOR']));
      await settle();
    });

    it('handles an existing profile (409) and refreshes the session', async () => {
      await fillValidForm();
      await submit();

      httpTesting.expectOne(CREATE_URL).flush(
        {
          statusCode: 409,
          message: 'Esta cuenta ya tiene un perfil de trabajador',
          error: 'Conflict',
        },
        { status: 409, statusText: 'Conflict' },
      );
      (await pending(ME_URL)).flush(userWithRoles(['CLIENTE', 'TRABAJADOR']));
      await settle();

      const alert = element.querySelector('#worker-error-summary');
      expect(alert?.textContent).toContain('Esta cuenta ya tiene un perfil de trabajador');
      expect(alert?.querySelector('a')?.getAttribute('href')).toBe('/trabajador/perfil');
      expect(document.activeElement).toBe(alert);
    });

    it('shows business errors (400) and reloads the catalogs', async () => {
      await fillValidForm();
      await submit();

      httpTesting.expectOne(CREATE_URL).flush(
        {
          statusCode: 400,
          message: ['La zona seleccionada no está activa'],
          error: 'Bad Request',
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await loadCatalogs();

      const alert = element.querySelector('#worker-error-summary');
      expect(alert?.textContent).toContain('Revise los campos marcados');
      expect(alert?.textContent).toContain('La zona seleccionada no está activa');
    });

    it('maps DTO validation messages to their fields', async () => {
      await fillValidForm();
      await submit();

      httpTesting.expectOne(CREATE_URL).flush(
        {
          statusCode: 400,
          message: ['yearsOfExperience must not be greater than 70'],
          error: 'Bad Request',
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await loadCatalogs();

      expect(errorText('yearsOfExperience')).toContain('El servidor rechazó este dato');
    });

    it('shows an error with retry when the catalogs cannot be loaded', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      (await pending(ZONES_URL)).error(new ProgressEvent('error'));
      (await pending(CATEGORIES_URL)).flush(CATEGORIES);
      await settle();

      const alert = element.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('No se pudo conectar con el servidor');
      expect(element.querySelector('form')).toBeNull();

      alert?.querySelector('button')?.click();
      fixture.detectChanges();
      await loadCatalogs();
      expect(element.querySelector('form')).not.toBeNull();
    });
  });

  describe('phone required to submit the profile later', () => {
    it('links to Mi cuenta when the account has no phone', async () => {
      render(['CLIENTE']);
      await loadCatalogs();

      const link = element.querySelector('a[href="/cliente/mi-cuenta"]');
      expect(link?.textContent).toContain('Registrar mi teléfono');
    });

    it('hides the notice once the session has a phone', async () => {
      render(['CLIENTE']);
      await loadCatalogs();

      const session = TestBed.inject(SessionStore);
      const user = session.user();
      if (user) {
        session.setUser({ ...user, phone: '70000000' });
      }
      fixture.detectChanges();

      expect(element.querySelector('a[href="/cliente/mi-cuenta"]')).toBeNull();
    });
  });

  describe('account that already has the TRABAJADOR role', () => {
    beforeEach(() => render(['CLIENTE', 'TRABAJADOR']));

    it('shows the existing profile instead of the form', async () => {
      (await pending(OWN_PROFILE_URL)).flush(workerProfile({ status: 'PENDIENTE' }));
      await settle();

      httpTesting.expectNone(ZONES_URL);
      expect(element.querySelector('form')).toBeNull();
      expect(element.querySelector('.status-badge')?.textContent).toBe('Pendiente de revisión');
      expect(element.querySelector('a[href="/trabajador/perfil"]')).not.toBeNull();
    });

    it('offers the form when the account has the role but no profile (404)', async () => {
      (await pending(OWN_PROFILE_URL)).flush(
        { statusCode: 404, message: 'Aún no tiene un perfil de trabajador', error: 'Not Found' },
        { status: 404, statusText: 'Not Found' },
      );
      // El 404 activa la carga de catálogos; se responden antes de esperar la estabilidad.
      await loadCatalogs();

      expect(element.querySelector('form')).not.toBeNull();
    });
  });
});

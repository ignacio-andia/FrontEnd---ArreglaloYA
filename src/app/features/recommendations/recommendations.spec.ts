import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiUrl } from '../../core/http/api-url';
import { apiErrorInterceptor } from '../../core/interceptors/api-error.interceptor';
import { describeAuditDetails } from '../audit/utils/audit-details';
import { OrderStatus } from '../orders/models/order.model';
import { RecommendedWorkersComponent } from './components/recommended-workers/recommended-workers.component';
import {
  RecommendationSettings,
  RecommendationSettingsOverview,
  RecommendedWorker,
  WorkerRecommendation,
} from './models/recommendation.model';
import { RecommendationSettingsPageComponent } from './pages/recommendation-settings-page/recommendation-settings-page.component';
import { RecommendationsApiService } from './services/recommendations-api.service';

const ORDER_ID = '7d4c2a10-1111-4222-8333-444455556666';
const LIST_URL = apiUrl('orders', ORDER_ID, 'recommendations');
const SETTINGS_URL = apiUrl('admin', 'recommendation-settings');

function settings(overrides: Partial<RecommendationSettings> = {}): RecommendationSettings {
  return {
    id: 'settings-1',
    version: 1,
    reputationWeight: 50,
    completedServicesWeight: 30,
    availabilityWeight: 20,
    reviewsForConfidence: 3,
    completedServicesTarget: 10,
    availabilityHoursTarget: 20,
    neutralRating: 3,
    availabilityWindowDays: 7,
    createdAt: '2026-11-26T12:00:00.000Z',
    createdBy: null,
    ...overrides,
  };
}

function worker(overrides: Partial<RecommendedWorker> = {}): RecommendedWorker {
  return {
    rank: 1,
    workerId: 'worker-ana',
    firstName: 'Ana',
    lastName: 'Quispe',
    totalScore: '47.00',
    reputation: {
      reviewsCount: 2,
      averageRating: '5.00',
      adjustedRating: '3.80',
      score: '70.00',
      weight: 50,
      points: '35.00',
      explanation:
        'Promedio de 5.00 con 2 calificaciones; ajustado a 3.80 al sumar 3 calificaciones neutras de 3 estrellas.',
    },
    completedServices: {
      count: 2,
      target: 10,
      score: '20.00',
      weight: 30,
      points: '6.00',
      explanation: '2 servicios completados; con 10 o más el criterio llega al 100 %.',
    },
    availability: {
      weeklyScheduleHours: '7',
      bookedHours: '1',
      freeHours: '6',
      targetHours: 20,
      score: '30.00',
      weight: 20,
      points: '6.00',
      explanation:
        'Atiende 7 h por semana y tiene 1 h de trabajos acordados en los próximos 7 días: 6 h libres (con 20 h llega al 100 %).',
    },
    openOfferId: null,
    ...overrides,
  };
}

function recommendation(overrides: Partial<WorkerRecommendation> = {}): WorkerRecommendation {
  return {
    id: 'rec-2',
    orderId: ORDER_ID,
    createdAt: '2026-11-26T14:30:00.000Z',
    candidatesCount: 2,
    criteria: settings(),
    workers: [
      worker(),
      worker({
        rank: 2,
        workerId: 'worker-luis',
        firstName: 'Luis',
        lastName: 'Rojas',
        totalScore: '45.00',
        openOfferId: 'offer-luis',
      }),
    ],
    message: null,
    ...overrides,
  };
}

function overview(current: RecommendationSettings, ...older: RecommendationSettings[]) {
  return { current, history: [current, ...older] } satisfies RecommendationSettingsOverview;
}

describe('recommendations', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('RecommendationsApiService', () => {
    it('uses the order and admin endpoints with only the accepted fields', () => {
      const api = TestBed.inject(RecommendationsApiService);
      api.generate(ORDER_ID).subscribe();
      api.list(ORDER_ID).subscribe();
      api.getSettings().subscribe();
      api
        .updateSettings({
          reputationWeight: 40,
          completedServicesWeight: 40,
          availabilityWeight: 20,
          reviewsForConfidence: 3,
          completedServicesTarget: 10,
          availabilityHoursTarget: 20,
          ...({ version: 9 } as object),
        })
        .subscribe();

      const created = http.expectOne((req) => req.method === 'POST' && req.url === LIST_URL);
      expect(created.request.body).toEqual({});
      http.expectOne((req) => req.method === 'GET' && req.url === LIST_URL).flush([]);
      http
        .expectOne((req) => req.method === 'GET' && req.url === SETTINGS_URL)
        .flush(overview(settings()));
      const updated = http.expectOne((req) => req.method === 'PUT' && req.url === SETTINGS_URL);
      expect(updated.request.body).toEqual({
        reputationWeight: 40,
        completedServicesWeight: 40,
        availabilityWeight: 20,
        reviewsForConfidence: 3,
        completedServicesTarget: 10,
        availabilityHoursTarget: 20,
      });
      created.flush(recommendation());
      updated.flush(overview(settings({ version: 2 })));
    });
  });

  describe('RecommendedWorkersComponent', () => {
    async function open(status: OrderStatus, saved: WorkerRecommendation[]) {
      const fixture = TestBed.createComponent(RecommendedWorkersComponent);
      fixture.componentRef.setInput('orderId', ORDER_ID);
      fixture.componentRef.setInput('status', status);
      fixture.detectChanges();
      http.expectOne((req) => req.method === 'GET' && req.url === LIST_URL).flush(saved);
      await fixture.whenStable();
      return fixture;
    }
    const text = (element: HTMLElement) => element.textContent?.replace(/\s+/g, ' ') ?? '';
    const button = (element: HTMLElement, label: string) =>
      Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(label));

    it('shows the latest recommendation with the criteria used and each score', async () => {
      const fixture = await open('PUBLICADO', [
        recommendation(),
        recommendation({ id: 'rec-1', createdAt: '2026-11-26T13:00:00.000Z' }),
      ]);
      const element = fixture.nativeElement as HTMLElement;
      const content = text(element);

      expect(content).toContain('Trabajadores recomendados');
      expect(content).toContain(
        'Generada el 26/11/2026 10:30 · 2 trabajadores evaluados · criterios versión 1',
      );
      expect(content).toContain('Reputación (50 %)');
      expect(content).toContain('Servicios completados (30 %)');
      expect(content).toContain('Disponibilidad (20 %)');
      expect(content).toContain('70.00 × 50 % = 35.00 pts');
      expect(content).toContain('ajustado a 3.80');

      const names = Array.from(element.querySelectorAll('.recs__name')).map((n) =>
        n.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(names).toEqual(['Puesto 1: Ana Quispe', 'Puesto 2: Luis Rojas']);
      const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('.recs__link')).map(
        (a) => [a.textContent?.trim(), a.getAttribute('href')],
      );
      expect(links).toEqual([
        ['Ver perfil', '/cliente/buscar-trabajadores/worker-ana'],
        ['Ver perfil', '/cliente/buscar-trabajadores/worker-luis'],
        ['Ver su oferta', '/cliente/ofertas/offer-luis'],
      ]);
      expect(content).toContain('Todavía no envió una oferta para este pedido.');
      expect(element.querySelector('meter')?.getAttribute('aria-label')).toBe(
        'Puntaje total de Ana: 47.00 de 100',
      );

      const history = element.querySelectorAll('.recs__history-button');
      expect(history).toHaveLength(2);
      expect(history[0].getAttribute('aria-pressed')).toBe('true');
      expect(button(element, 'Actualizar recomendación')).toBeDefined();
    });

    it('generates a recommendation, saves it and shows it first', async () => {
      const fixture = await open('EN_NEGOCIACION', []);
      const element = fixture.nativeElement as HTMLElement;
      expect(text(element)).toContain('Todavía no se generó ninguna recomendación');

      button(element, 'Recomendar trabajadores')!.click();
      fixture.detectChanges();
      expect(button(element, 'Calculando')?.disabled).toBe(true);
      const request = http.expectOne((req) => req.method === 'POST' && req.url === LIST_URL);
      request.flush(recommendation());
      await fixture.whenStable();

      expect(text(element)).toContain('Se generó y guardó una recomendación nueva.');
      expect(text(element)).toContain('Ana Quispe');
      expect(button(element, 'Actualizar recomendación')).toBeDefined();
    });

    it('shows the backend message when the order no longer accepts recommendations', async () => {
      const fixture = await open('PUBLICADO', []);
      const element = fixture.nativeElement as HTMLElement;
      button(element, 'Recomendar trabajadores')!.click();
      http
        .expectOne((req) => req.method === 'POST' && req.url === LIST_URL)
        .flush(
          {
            statusCode: 409,
            message:
              'Solo se recomiendan trabajadores mientras el pedido está publicado o en negociación.',
          },
          { status: 409, statusText: 'Conflict' },
        );
      await fixture.whenStable();

      expect(element.querySelector('[role="alert"]')?.textContent).toContain(
        'publicado o en negociación',
      );
    });

    it('with a worker agreed only shows the saved recommendations, without generating', async () => {
      const fixture = await open('ACORDADO', [recommendation()]);
      const element = fixture.nativeElement as HTMLElement;

      expect(text(element)).toContain('Ana Quispe');
      expect(button(element, 'Actualizar recomendación')).toBeUndefined();
      expect(button(element, 'Recomendar trabajadores')).toBeUndefined();
    });

    it('shows nothing for a closed order without saved recommendations', async () => {
      const fixture = await open('CERRADO', []);
      expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
    });

    it('shows an older recommendation from the history and the empty message', async () => {
      const fixture = await open('PUBLICADO', [
        recommendation(),
        recommendation({
          id: 'rec-1',
          createdAt: '2026-11-26T13:00:00.000Z',
          candidatesCount: 0,
          workers: [],
          message:
            'Por ahora no hay trabajadores aprobados de esta categoría y zona para recomendar.',
        }),
      ]);
      const element = fixture.nativeElement as HTMLElement;
      element.querySelectorAll<HTMLButtonElement>('.recs__history-button')[1].click();
      fixture.detectChanges();

      expect(text(element)).toContain('Por ahora no hay trabajadores aprobados');
      expect(element.querySelector('.recs__list')).toBeNull();
      expect(
        element.querySelectorAll('.recs__history-button')[1].getAttribute('aria-pressed'),
      ).toBe('true');
    });
  });

  describe('RecommendationSettingsPageComponent', () => {
    async function open() {
      const fixture = TestBed.createComponent(RecommendationSettingsPageComponent);
      fixture.detectChanges();
      http
        .expectOne((req) => req.method === 'GET' && req.url === SETTINGS_URL)
        .flush(
          overview(
            settings({
              id: 'settings-2',
              version: 2,
              reputationWeight: 40,
              completedServicesWeight: 40,
              createdBy: { id: 'admin', firstName: 'Rosa', lastName: 'Mamani' },
            }),
            settings(),
          ),
        );
      await fixture.whenStable();
      return fixture;
    }
    const input = (element: HTMLElement, name: string) =>
      element.querySelector<HTMLInputElement>(`#settings-${name}`)!;
    const type = (element: HTMLElement, name: string, value: string) => {
      const field = input(element, name);
      field.value = value;
      field.dispatchEvent(new Event('input'));
    };
    const submit = (element: HTMLElement) =>
      element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();

    it('fills the form with the current version and lists every version', async () => {
      const fixture = await open();
      const element = fixture.nativeElement as HTMLElement;

      expect(input(element, 'reputationWeight').value).toBe('40');
      expect(input(element, 'completedServicesWeight').value).toBe('40');
      expect(input(element, 'availabilityWeight').value).toBe('20');
      expect(element.textContent).toContain('Versión vigente: 2');
      expect(element.textContent).toContain('guardada por Rosa Mamani.');
      const rows = Array.from(element.querySelectorAll('tbody tr')).map((row) =>
        row.querySelector('th')?.textContent?.trim(),
      );
      expect(rows).toEqual(['2', '1']);
      expect(element.querySelector('tbody')?.textContent).toContain('Configuración inicial');
    });

    it('does not send weights that do not add up to 100', async () => {
      const fixture = await open();
      const element = fixture.nativeElement as HTMLElement;
      type(element, 'reputationWeight', '60');
      submit(element);
      fixture.detectChanges();

      expect(element.textContent).toContain('ahora suman 120');
      expect(input(element, 'reputationWeight').getAttribute('aria-invalid')).toBe('true');
      expect(input(element, 'reputationWeight').getAttribute('aria-describedby')).toContain(
        'settings-sum-error',
      );
    });

    it('validates the range of each field', async () => {
      const fixture = await open();
      const element = fixture.nativeElement as HTMLElement;
      type(element, 'availabilityHoursTarget', '200');
      submit(element);
      fixture.detectChanges();

      expect(
        element.querySelector('#settings-availabilityHoursTarget-error')?.textContent,
      ).toContain('entre 1 y 168');
    });

    it('saves a new version and shows it', async () => {
      const fixture = await open();
      const element = fixture.nativeElement as HTMLElement;
      type(element, 'reputationWeight', '20');
      type(element, 'completedServicesWeight', '20');
      type(element, 'availabilityWeight', '60');
      submit(element);

      const request = http.expectOne((req) => req.method === 'PUT' && req.url === SETTINGS_URL);
      expect(request.request.body).toEqual({
        reputationWeight: 20,
        completedServicesWeight: 20,
        availabilityWeight: 60,
        reviewsForConfidence: 3,
        completedServicesTarget: 10,
        availabilityHoursTarget: 20,
      });
      request.flush(
        overview(
          settings({
            id: 'settings-3',
            version: 3,
            reputationWeight: 20,
            completedServicesWeight: 20,
            availabilityWeight: 60,
          }),
          settings({ id: 'settings-2', version: 2 }),
          settings(),
        ),
      );
      await fixture.whenStable();

      expect(element.textContent).toContain('Se guardó la versión 3');
      expect(element.querySelectorAll('tbody tr')).toHaveLength(3);
    });

    it('shows the backend error when the values did not change', async () => {
      const fixture = await open();
      const element = fixture.nativeElement as HTMLElement;
      submit(element);
      http
        .expectOne((req) => req.method === 'PUT' && req.url === SETTINGS_URL)
        .flush(
          {
            statusCode: 409,
            message: 'La configuración ya tiene esos valores: no se creó una versión nueva.',
          },
          { status: 409, statusText: 'Conflict' },
        );
      await fixture.whenStable();

      expect(element.querySelector('#settings-save-error')?.textContent).toContain(
        'ya tiene esos valores',
      );
    });
  });

  it('the audit log describes a change of criteria', () => {
    expect(
      describeAuditDetails({
        details: {
          version: 2,
          previousVersion: 1,
          // jsonb reordena las claves: se muestran en el orden del formulario y sin las iguales.
          before: { availabilityWeight: 20, reputationWeight: 50, reviewsForConfidence: 3 },
          after: { availabilityWeight: 60, reputationWeight: 20, reviewsForConfidence: 3 },
        },
      }),
    ).toEqual([
      'Versión: 1 → 2',
      'Peso de la reputación (%): 50 → 20',
      'Peso de la disponibilidad (%): 20 → 60',
    ]);
  });
});

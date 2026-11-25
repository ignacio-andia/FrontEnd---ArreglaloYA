import { apiUrl } from '../../../core/http/api-url';
import { setupOfferPage } from '../../offers/testing/offers.fixtures';
import { CATEGORIES, ZONE } from '../../worker-profile/testing/worker-profile.fixtures';
import {
  PublicWorkerProfile,
  WorkerSearchResult,
  ratingLabel,
} from '../models/public-worker.model';
import { PUBLIC_WORKER_ROUTES, WORKER_SEARCH_ROUTES } from '../workers.routes';

const WORKER_ID = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d';
const PERSON = {
  workerId: WORKER_ID,
  firstName: 'Tomás',
  lastName: 'Rojas',
  yearsOfExperience: 1,
  description: 'Atiendo fugas',
  zone: { id: ZONE.id, name: ZONE.name, isActive: true },
  specialties: [{ id: CATEGORIES[1].id, name: 'Plomería', isActive: true }],
};
const result: WorkerSearchResult = {
  ...PERSON,
  schedules: [{ dayOfWeek: 'LUNES', startTime: '08:00', endTime: '12:00' }],
  rating: { average: null, count: 0 },
};
const searchPage = (data: WorkerSearchResult[], message: string | null = null, totalPages = 1) => ({
  data,
  meta: { page: 1, limit: 10, total: data.length, totalPages },
  message,
});
const profile = (overrides: Partial<PublicWorkerProfile> = {}): PublicWorkerProfile => ({
  profile: PERSON,
  rating: { average: null, count: 0, message: 'Este trabajador aún no tiene calificaciones.' },
  recentOpinions: [],
  ...overrides,
});
const SEARCH_URL = `/cliente/buscar-trabajadores?categoria=${CATEGORIES[1].id}&zona=${ZONE.id}`;

describe('worker search and public profile', () => {
  let view: Awaited<ReturnType<typeof setupOfferPage>>;

  beforeEach(async () => {
    view = await setupOfferPage(
      [
        { path: 'cliente/buscar-trabajadores', children: WORKER_SEARCH_ROUTES },
        { path: 'trabajadores', children: PUBLIC_WORKER_ROUTES },
      ],
      'CLIENTE',
    );
  });

  afterEach(() => {
    view.http.verify();
    sessionStorage.clear();
  });

  async function catalogs(): Promise<void> {
    await view.answer('catalogs/categories', CATEGORIES);
    await view.answer('catalogs/zones', [ZONE]);
  }
  const searchRequest = () => view.request('GET', 'workers', 'search');

  describe('search (#114)', () => {
    it('asks nothing until both filters are chosen', async () => {
      await view.visit('/cliente/buscar-trabajadores');
      await catalogs();
      expect(view.content()).toContain('Todavía no realizó una búsqueda.');

      await view.click('button[type="submit"]');
      expect(view.content()).toContain('Elija la categoría y la zona.');
      view.http.expectNone((request) => request.url === apiUrl('workers', 'search'));

      await view.type('#search-category', CATEGORIES[1].id);
      await view.type('#search-zone', ZONE.id);
      await view.click('button[type="submit"]');
      const request = await searchRequest();
      expect(request.request.params.get('categoryId')).toBe(CATEGORIES[1].id);
      expect(request.request.params.get('zoneId')).toBe(ZONE.id);
      expect(request.request.params.get('limit')).toBe('10');
      request.flush(searchPage([result]));
      await view.render();
      expect(view.content()).toContain('Tomás Rojas');
    });

    it('shows experience, schedules and the absence of ratings without inventing them', async () => {
      await view.visit(SEARCH_URL);
      await catalogs();
      (await searchRequest()).flush(searchPage([result]));
      await view.render();

      expect(view.content()).toContain('1 año de experiencia');
      expect(view.content()).toContain('Lunes: 08:00 a 12:00');
      expect(view.content()).toContain('Sin calificaciones todavía');
      expect(view.content()).toContain('no reservan una cita');
      expect(view.element('.result a')?.getAttribute('href')).toContain(
        `/cliente/buscar-trabajadores/${WORKER_ID}?categoria=`,
      );
    });

    it('shows the backend message when there are no results', async () => {
      await view.visit(SEARCH_URL);
      await catalogs();
      (await searchRequest()).flush(searchPage([], 'No encontramos trabajadores.', 0));
      await view.render();

      expect(view.content()).toContain('No encontramos trabajadores.');
      expect(view.element('a[href="/cliente/publicar-pedido"]')?.textContent).toContain(
        'Publicar un pedido',
      );
    });

    it('shows and retries an error', async () => {
      await view.visit(SEARCH_URL);
      await catalogs();
      await view.fail('workers/search', 500, 'Fallo');
      await view.click('app-error-alert button');
      await view.answer('workers/search', searchPage([result]));
      expect(view.content()).toContain('Tomás Rojas');
    });
  });

  describe('public profile (#106, #107)', () => {
    const path = `workers/${WORKER_ID}/public-profile`;

    it('shows the public data and links back to the search from the client area', async () => {
      await view.visit(`/cliente/buscar-trabajadores/${WORKER_ID}`);
      await view.answer(path, profile());

      for (const text of [
        'Tomás Rojas',
        'Atiendo fugas',
        'Zona Norte',
        'Este trabajador aún no tiene calificaciones.',
        'Volver a la búsqueda',
      ]) {
        expect(view.content()).toContain(text);
      }
      expect(view.element(`a[href="/trabajadores/${WORKER_ID}"]`)).not.toBeNull();
    });

    it('has no search link on the public address and loads more opinions on request', async () => {
      const opinion = {
        id: 'o1',
        rating: 4,
        comment: 'Buen trabajo',
        createdAt: '2026-11-20T10:00:00.000Z',
        author: 'María P.',
      };
      await view.visit(`/trabajadores/${WORKER_ID}`);
      await view.answer(
        path,
        profile({ rating: { average: 4.5, count: 6, message: null }, recentOpinions: [opinion] }),
      );

      expect(view.content()).not.toContain('Volver a la búsqueda');
      expect(view.content()).toContain('4,5 de 5 (6 calificaciones)');
      expect(view.content()).toContain('Buen trabajo');

      await view.click('.offers__card button');
      const request = await view.request('GET', 'workers', WORKER_ID, 'reviews');
      expect(request.request.params.get('limit')).toBe('50');
      request.flush({
        data: [opinion, { ...opinion, id: 'o2', comment: 'Muy puntual' }],
        meta: { page: 1, limit: 50, total: 2, totalPages: 1 },
      });
      await view.render();
      expect(view.content()).toContain('Muy puntual');
    });

    it('explains that a profile that is not approved is unavailable', async () => {
      await view.visit(`/trabajadores/${WORKER_ID}`);
      await view.fail(path, 404, 'El trabajador no existe');

      expect(view.content()).toContain('Perfil no disponible');
    });
  });

  it('labels a rating with its count', () => {
    expect(ratingLabel({ average: 5, count: 1 })).toBe('5 de 5 (1 calificación)');
  });
});

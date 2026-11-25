import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { User } from '../../../core/auth/auth.models';
import { SessionStore } from '../../../core/auth/session.store';
import { apiUrl } from '../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { RoleName } from '../../../core/models/role.model';
import { WorkerOrder } from '../../orders/models/order.model';
import { CATEGORY, CLIENT, ZONE, ownerOrder } from '../../orders/testing/order.fixtures';
import { Offer, OfferDetail, OfferEvent, ReceivedOffer } from '../models/offer.model';

/**
 * Datos y utilidades de las specs de ofertas, con la forma exacta de los contratos.
 * Solo se importan desde archivos `.spec.ts`.
 */
export const ORDER_ID = ownerOrder().id;
export const OFFER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

export const PROPOSAL: OfferEvent = {
  type: 'PROPUESTA',
  round: 1,
  amount: '180.00',
  actorType: 'USUARIO',
  actorRole: 'TRABAJADOR',
  systemProcess: null,
  reason: null,
  createdAt: '2026-11-20T14:00:00.000Z',
};

export function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: OFFER_ID,
    orderId: ORDER_ID,
    status: 'VIGENTE',
    round: 1,
    amount: '180.00',
    turn: 'CLIENTE',
    requiresVisit: true,
    visitCost: '0.00',
    materialsIncluded: false,
    proposedStartAt: '2026-11-30T14:00:00.000Z',
    estimatedDurationMinutes: 90,
    expiresAt: '2026-11-21T14:00:00.000Z',
    closedAt: null,
    createdAt: '2026-11-20T14:00:00.000Z',
    updatedAt: '2026-11-20T14:00:00.000Z',
    ...overrides,
  };
}

export function received(overrides: Partial<ReceivedOffer> = {}): ReceivedOffer {
  return {
    ...offer(),
    worker: { id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', firstName: 'Luis', lastName: 'Rojas' },
    ...overrides,
  };
}

export function detail(
  overrides: Partial<ReceivedOffer> = {},
  history: OfferEvent[] = [PROPOSAL],
): OfferDetail<ReceivedOffer> {
  return { ...received(overrides), history };
}

export function workerOrder(overrides: Partial<WorkerOrder> = {}): WorkerOrder {
  return {
    id: ORDER_ID,
    status: 'PUBLICADO',
    category: { id: CATEGORY.id, name: CATEGORY.name, isActive: true },
    zone: { id: ZONE.id, name: ZONE.name, isActive: true },
    description: 'Fuga de agua debajo del lavaplatos de la cocina',
    budgetAmount: '150.50',
    images: [],
    revision: 1,
    publishedAt: '2026-11-15T14:40:00.000Z',
    expiresAt: '2026-11-22T14:40:00.000Z',
    lastEditedAt: null,
    ...overrides,
  };
}

export function page<T>(data: T[], total = data.length, limit = 12) {
  return {
    data,
    meta: { page: 1, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

function user(role: RoleName): User {
  return { ...CLIENT, roles: [role] };
}

/** Monta las rutas indicadas con una sesión del rol dado y expone utilidades de prueba. */
export async function setupOfferPage(routes: Routes, role: RoleName) {
  sessionStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  TestBed.inject(SessionStore).setSession({
    accessToken: 'jwt-token',
    tokenType: 'Bearer',
    user: user(role),
  });
  const http = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  const harness = await RouterTestingHarness.create();

  /** Deja que se procesen respuestas y efectos pendientes y actualiza la vista. */
  async function render(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
  }

  function root(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  function request(method: string, ...segments: string[]) {
    const url = apiUrl(...(segments as [string]));
    return vi.waitFor(() => {
      harness.detectChanges();
      return http.expectOne((req) => req.method === method && req.url === url);
    });
  }

  return {
    http,
    router,
    render,
    root,
    request,
    async visit(url: string): Promise<void> {
      // Sin esperar estabilidad: las consultas quedan pendientes hasta responderlas.
      void router.navigateByUrl(url);
      await render();
    },
    /** Responde un `GET` pendiente. */
    async answer(path: string, body: object): Promise<void> {
      (await request('GET', ...path.split('/'))).flush(body);
      await render();
    },
    async fail(
      path: string,
      status: number,
      message: string | string[] = 'Error',
      method = 'GET',
    ): Promise<void> {
      (await request(method, ...path.split('/'))).flush(
        { statusCode: status, message, error: 'Error' },
        { status, statusText: 'Error' },
      );
      await render();
    },
    text(selector = ':first-child'): string {
      return (root().querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
    },
    content(): string {
      return (root().textContent ?? '').replace(/\s+/g, ' ');
    },
    element<T extends HTMLElement = HTMLElement>(selector: string): T | null {
      return root().querySelector<T>(selector);
    },
    async click(selector: string): Promise<void> {
      const target = root().querySelector<HTMLElement>(selector);
      if (target === null) {
        throw new Error(`No existe ${selector}`);
      }
      target.click();
      await render();
    },
    async type(selector: string, value: string): Promise<void> {
      const control = root().querySelector<HTMLInputElement | HTMLSelectElement>(selector);
      if (control === null) {
        throw new Error(`No existe ${selector}`);
      }
      control.value = value;
      control.dispatchEvent(
        new Event(control instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }),
      );
      control.dispatchEvent(new Event('blur'));
      await render();
    },
  };
}

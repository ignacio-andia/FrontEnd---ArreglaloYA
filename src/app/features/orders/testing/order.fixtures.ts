import { HttpTestingController } from '@angular/common/http/testing';
import { User } from '../../../core/auth/auth.models';
import { CatalogOption } from '../../catalogs/models/catalog.model';
import { OwnerOrder } from '../models/order.model';

/**
 * Datos de prueba de las specs de orders, con la forma exacta de los contratos.
 * Solo se importan desde archivos `.spec.ts`.
 */
export const CATEGORY: CatalogOption = {
  id: '2b7e9d1c-3f4a-4b5c-8d6e-7f8091a2b3c4',
  name: 'Plomería',
  description: null,
};

export const ZONE: CatalogOption = {
  id: '3f1d6c2e-8a4b-4c5d-9e6f-7a8b9c0d1e2f',
  name: 'Norte',
  description: null,
};

export const CLIENT: User = {
  id: '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f',
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.com',
  phone: null,
  status: 'ACTIVO',
  roles: ['CLIENTE'],
  createdAt: '2026-11-15T14:30:00.000Z',
  updatedAt: '2026-11-15T14:30:00.000Z',
};

export function ownerOrder(overrides: Partial<OwnerOrder> = {}): OwnerOrder {
  return {
    id: 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b',
    status: 'PUBLICADO',
    category: { id: CATEGORY.id, name: CATEGORY.name, isActive: true },
    zone: { id: ZONE.id, name: ZONE.name, isActive: true },
    description: 'Fuga de agua debajo del lavaplatos de la cocina',
    budgetAmount: '150.50',
    images: [
      {
        id: 'f6a7b8c9-d0e1-4f2a-8b3c-4d5e6f7a8b9c',
        position: 1,
        width: 1600,
        height: 1067,
        sizeBytes: 98213,
        thumbnailSizeBytes: 12044,
      },
    ],
    revision: 1,
    publishedAt: '2026-11-15T14:40:00.000Z',
    expiresAt: '2026-11-22T14:40:00.000Z',
    lastEditedAt: null,
    address: { addressLine: 'Av. Ejemplo 123', reference: 'Portón verde' },
    cancelledAt: null,
    anonymizedAt: null,
    createdAt: '2026-11-15T14:40:00.000Z',
    updatedAt: '2026-11-15T14:40:00.000Z',
    canEdit: true,
    canCancel: true,
    ...overrides,
  };
}

/** Fotografía local de prueba con el tamaño indicado (contenido de relleno). */
export function photo(name = 'fuga.jpg', type = 'image/jpeg', size = 2048): File {
  return new File([new Uint8Array(size)], name, { type });
}

/**
 * Sustituye `URL.createObjectURL`/`revokeObjectURL` (jsdom no los implementa) y registra las URLs
 * creadas y liberadas.
 */
export function stubObjectUrls(): { created: string[]; revoked: string[] } {
  const created: string[] = [];
  const revoked: string[] = [];
  Object.assign(URL, {
    createObjectURL: () => {
      const url = `blob:preview-${created.length + 1}`;
      created.push(url);
      return url;
    },
    revokeObjectURL: (url: string) => revoked.push(url),
  });
  return { created, revoked };
}

/**
 * El detalle del pedido consulta sus recomendaciones de trabajadores
 * (`GET /orders/:orderId/recommendations`): las pruebas que no tratan de eso las responden vacías
 * antes de `verify()`.
 */
export function flushRecommendations(httpTesting: HttpTestingController): void {
  httpTesting
    .match((request) => request.method === 'GET' && request.url.endsWith('/recommendations'))
    .filter((request) => !request.cancelled)
    .forEach((request) => request.flush([]));
}

/**
 * Espera la consulta de recomendaciones que hace el detalle al mostrarse y la responde vacía: con
 * una petición pendiente la aplicación no queda estable (`whenStable`).
 */
export async function answerRecommendations(httpTesting: HttpTestingController): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const found = httpTesting.match(
      (request) => request.method === 'GET' && request.url.endsWith('/recommendations'),
    );
    if (found.length > 0) {
      found.forEach((request) => request.flush([]));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('El detalle no consultó sus recomendaciones');
}

import { ORDER_ID } from '../../offers/testing/offers.fixtures';
import { Claim } from '../models/claim.model';

/**
 * Datos de prueba de reclamos, con la forma exacta de los contratos. Solo se importan desde
 * archivos `.spec.ts`.
 */
export const CLAIM_ID = 'c1a1b2c3-d4e5-4f6a-8b9c-0d1e2f3a4b5c';

export function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: CLAIM_ID,
    orderId: ORDER_ID,
    status: 'ABIERTO',
    description: 'Sigue goteando por la unión',
    images: [
      { id: 'i1', position: 1, mimeType: 'image/webp', width: 800, height: 600, sizeBytes: 100 },
      { id: 'i2', position: 2, mimeType: 'image/webp', width: 800, height: 600, sizeBytes: 100 },
    ],
    decision: null,
    justification: null,
    decidedAt: null,
    createdAt: '2026-11-22T14:00:00.000Z',
    ...overrides,
  };
}

export function resolved(overrides: Partial<Claim> = {}): Claim {
  return claim({
    status: 'RESUELTO',
    decision: 'El trabajador debe revisar la unión.',
    justification: 'Las fotografías muestran la fuga.',
    decidedAt: '2026-11-23T14:00:00.000Z',
    ...overrides,
  });
}

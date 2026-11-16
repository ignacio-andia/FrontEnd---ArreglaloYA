import { User } from '../../../core/auth/auth.models';
import { RoleName } from '../../../core/models/role.model';
import { CatalogOption } from '../../catalogs/models/catalog.model';
import { WorkerProfile } from '../models/worker-profile.model';

/**
 * Datos de prueba de las specs de worker-profile, con la forma exacta de los contratos.
 * Solo se importan desde archivos `.spec.ts`.
 */
export const ZONE: CatalogOption = {
  id: '3f1d6c2e-8a4b-4c5d-9e6f-7a8b9c0d1e2f',
  name: 'Zona Norte',
  description: null,
};

export const CATEGORIES: CatalogOption[] = [
  { id: '2b7e9d1c-3f4a-4b5c-8d6e-7f8091a2b3c4', name: 'Electricidad', description: null },
  { id: '3c8f0e2d-4a5b-4c6d-9e7f-8091a2b3c4d5', name: 'Plomería', description: null },
];

export function userWithRoles(roles: RoleName[]): User {
  return {
    id: '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f',
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    phone: null,
    status: 'ACTIVO',
    roles,
    createdAt: '2026-11-15T14:30:00.000Z',
    updatedAt: '2026-11-15T14:30:00.000Z',
  };
}

export function workerProfile(overrides: Partial<WorkerProfile> = {}): WorkerProfile {
  return {
    id: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f',
    userId: '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f',
    status: 'BORRADOR',
    yearsOfExperience: 5,
    description: null,
    submittedAt: null,
    createdAt: '2026-11-15T14:30:00.000Z',
    updatedAt: '2026-11-15T14:30:00.000Z',
    zone: { id: ZONE.id, name: ZONE.name, isActive: true },
    zoneRequiresChange: false,
    specialties: [{ id: CATEGORIES[1].id, name: CATEGORIES[1].name, isActive: true }],
    schedules: [],
    pendingRequirements: [
      { field: 'phone', message: 'Registre un teléfono de contacto en su cuenta' },
      { field: 'schedules', message: 'Registre al menos un horario de atención activo' },
    ],
    canEdit: true,
    canSubmit: false,
    ...overrides,
  };
}

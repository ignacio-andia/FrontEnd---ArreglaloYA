import { workerProfile } from '../../worker-profile/testing/worker-profile.fixtures';
import { WorkerProfileStatus } from '../../worker-profile/models/worker-profile-status.model';
import {
  AdminWorkerProfile,
  AdminWorkerProfileSummary,
  ProfileDecision,
} from '../models/admin-worker-profile.model';

/** Datos de las specs de verificación. Solo se importan desde archivos `.spec.ts`. */
export const PROFILE_ID = workerProfile().id;

const ACCOUNT = {
  firstName: 'Juan',
  lastName: 'Rojas',
  email: 'juan@example.com',
  phone: '70000000',
  status: 'ACTIVO' as const,
};

export function adminSummary(
  overrides: Partial<AdminWorkerProfileSummary> = {},
): AdminWorkerProfileSummary {
  const profile = workerProfile();
  return {
    id: profile.id,
    userId: profile.userId,
    status: 'PENDIENTE',
    account: ACCOUNT,
    zone: profile.zone,
    specialties: profile.specialties,
    submittedAt: '2026-11-22T14:00:00.000Z',
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    ...overrides,
  };
}

const DECISIONS: Partial<Record<WorkerProfileStatus, ProfileDecision[]>> = {
  PENDIENTE: ['APROBADO', 'OBSERVADO', 'RECHAZADO'],
  APROBADO: ['SUSPENDIDO'],
  SUSPENDIDO: ['APROBADO'],
};

export function adminProfile(
  status: WorkerProfileStatus = 'PENDIENTE',
  overrides: Partial<AdminWorkerProfile> = {},
): AdminWorkerProfile {
  return {
    profile: workerProfile({
      status,
      pendingRequirements: [],
      schedules: [
        { id: 's1', dayOfWeek: 'LUNES', startTime: '08:00', endTime: '12:00', isActive: true },
      ],
    }),
    account: { ...ACCOUNT, roles: ['CLIENTE', 'TRABAJADOR'] },
    statusReason: null,
    history: [
      {
        id: 'h1',
        fromStatus: 'BORRADOR',
        toStatus: 'PENDIENTE',
        reason: null,
        createdAt: '2026-11-22T14:00:00.000Z',
        changedBy: 'TRABAJADOR',
        changedByUser: { id: 'u1', firstName: 'Juan', lastName: 'Rojas' },
      },
    ],
    allowedDecisions: DECISIONS[status] ?? [],
    ...overrides,
  };
}

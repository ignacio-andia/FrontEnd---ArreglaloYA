import { UserStatus } from '../../../core/auth/auth.models';
import { PageQuery } from '../../../core/models/pagination.model';
import { RoleName } from '../../../core/models/role.model';
import { CatalogRef } from '../../catalogs/models/catalog.model';
import { WorkerProfileStatus } from '../../worker-profile/models/worker-profile-status.model';
import {
  WorkerProfile,
  WorkerStatusHistoryEntry,
} from '../../worker-profile/models/worker-profile.model';

/** Datos de la cuenta que ve el administrador (`AdminAccountSummary`). */
export interface AdminAccountSummary {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: UserStatus;
}

/** Fila del listado `GET /worker-profile/admin/profiles` (`AdminWorkerProfileSummary`). */
export interface AdminWorkerProfileSummary {
  id: string;
  userId: string;
  status: WorkerProfileStatus;
  account: AdminAccountSummary;
  zone: CatalogRef;
  specialties: CatalogRef[];
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminStatusHistoryEntry extends WorkerStatusHistoryEntry {
  changedByUser: { id: string; firstName: string; lastName: string };
}

/** Estados a los que un administrador puede pasar un perfil (`ADMIN_TARGET_STATUSES`). */
export type ProfileDecision = Extract<
  WorkerProfileStatus,
  'APROBADO' | 'OBSERVADO' | 'RECHAZADO' | 'SUSPENDIDO'
>;

/** Detalle `GET /worker-profile/admin/profiles/:profileId` (`AdminWorkerProfileView`). */
export interface AdminWorkerProfile {
  profile: WorkerProfile;
  account: AdminAccountSummary & { roles: RoleName[] };
  /** Motivo privado del cambio más reciente al estado vigente. */
  statusReason: string | null;
  /** Más reciente primero. */
  history: AdminStatusHistoryEntry[];
  /** Decisiones que el backend permite desde el estado actual. */
  allowedDecisions: ProfileDecision[];
}

/** Filtros del listado. El perfil del propio administrador nunca aparece. */
export interface AdminWorkerProfilesQuery extends PageQuery {
  status?: WorkerProfileStatus;
  zoneId?: string;
  categoryId?: string;
}

/** Cuerpo de `PATCH …/status` (`ChangeWorkerProfileStatusDto`). */
export interface ChangeProfileStatusRequest {
  status: ProfileDecision;
  reason?: string;
}

/** `@MaxLength(1000)` del motivo. */
export const DECISION_REASON_MAX_LENGTH = 1000;

/** Decisiones que exigen un motivo (`STATUSES_REQUIRING_REASON`). */
export const DECISIONS_REQUIRING_REASON: readonly ProfileDecision[] = [
  'OBSERVADO',
  'RECHAZADO',
  'SUSPENDIDO',
];

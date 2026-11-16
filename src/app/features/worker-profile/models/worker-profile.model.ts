import { CatalogRef } from '../../catalogs/models/catalog.model';
import { WeekDay } from './week-day.model';
import { WorkerProfileStatus } from './worker-profile-status.model';

/**
 * Respuesta de `GET /worker-profile/me/eligibility` (`WorkerEligibility`).
 *
 * - `eligible`: elegibilidad efectiva; `true` solo con cuenta ACTIVO, rol TRABAJADOR y perfil APROBADO.
 * - `status`: estado del perfil; `null` si la cuenta no está activa, no tiene el rol o no tiene perfil.
 * - `message`: texto listo para mostrar al usuario.
 * - `reason`: motivo registrado por el administrador para el estado vigente.
 */
export interface WorkerEligibility {
  eligible: boolean;
  status: WorkerProfileStatus | null;
  message: string;
  reason: string | null;
}

/** Horario de atención (`ScheduleView`). `endTime` puede ser `"24:00"`. */
export interface Schedule {
  id: string;
  dayOfWeek: WeekDay;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

/** Requisito pendiente para enviar el perfil a revisión, con su mensaje para el usuario. */
export interface PendingRequirement {
  field: 'phone' | 'specialties' | 'zone' | 'schedules';
  message: string;
}

/**
 * Perfil de trabajador (`WorkerProfileView`). Las fechas son strings ISO 8601 en UTC.
 * `canEdit`, `canSubmit`, `zoneRequiresChange` y `pendingRequirements` los calcula el backend.
 */
export interface WorkerProfile {
  id: string;
  userId: string;
  status: WorkerProfileStatus;
  yearsOfExperience: number;
  description: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  zone: CatalogRef;
  zoneRequiresChange: boolean;
  specialties: CatalogRef[];
  schedules: Schedule[];
  pendingRequirements: PendingRequirement[];
  canEdit: boolean;
  canSubmit: boolean;
}

/**
 * Horario de atención que se envía (`ScheduleItemDto`). Horas `HH:mm` en 24 horas; el backend
 * admite `"24:00"` solo como fin. `isActive` es opcional (por defecto `true`).
 */
export interface ScheduleItemRequest {
  dayOfWeek: WeekDay;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

/**
 * Cuerpo de `POST /worker-profile` (`CreateWorkerProfileDto`).
 * `description` y `schedules` se pueden omitir. Nombre, correo, teléfono y estado no van aquí.
 */
export interface CreateWorkerProfileRequest {
  yearsOfExperience: number;
  description?: string;
  zoneId: string;
  categoryIds: string[];
  schedules?: ScheduleItemRequest[];
}

/**
 * Cuerpo de `PATCH /worker-profile/me` (`UpdateWorkerProfileDto`): al menos una propiedad.
 * Solo en BORRADOR u OBSERVADO; `zoneId` solo puede cambiar en BORRADOR (403 en otro estado).
 * `description: null` (o vacía) borra la descripción.
 */
export interface UpdateWorkerProfileRequest {
  yearsOfExperience?: number;
  description?: string | null;
  zoneId?: string;
}

/** Entrada del historial de estados (`StatusHistoryEntry`). */
export interface WorkerStatusHistoryEntry {
  id: string;
  fromStatus: WorkerProfileStatus | null;
  toStatus: WorkerProfileStatus;
  reason: string | null;
  createdAt: string;
  changedBy: 'TRABAJADOR' | 'ADMINISTRADOR';
}

/** Respuesta de `GET /worker-profile/me/status` (`WorkerStatusView`). */
export interface WorkerStatus {
  status: WorkerProfileStatus;
  statusReason: string | null;
  history: WorkerStatusHistoryEntry[];
}

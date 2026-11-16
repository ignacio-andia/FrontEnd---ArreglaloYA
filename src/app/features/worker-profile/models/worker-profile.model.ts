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
 * Cuerpo de `POST /worker-profile` (`CreateWorkerProfileDto`).
 * `description` se puede omitir; el DTO también admite `schedules`, que se incorporará con la
 * gestión de horarios (hoy el perfil se crea sin horarios).
 */
export interface CreateWorkerProfileRequest {
  yearsOfExperience: number;
  description?: string;
  zoneId: string;
  categoryIds: string[];
}

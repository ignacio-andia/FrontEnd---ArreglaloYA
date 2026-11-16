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

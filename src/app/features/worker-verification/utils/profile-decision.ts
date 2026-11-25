import { apiErrorMessages, apiErrorStatus } from '../../../shared/utils/api-error-message';
import { WorkerProfileStatus } from '../../worker-profile/models/worker-profile-status.model';
import { ProfileDecision } from '../models/admin-worker-profile.model';

/** Texto de cada decisión. `reactivate` es aprobar un perfil suspendido. */
export interface DecisionCopy {
  action: string;
  heading: string;
  confirm: string;
  explanation: string;
  done: string;
  destructive: boolean;
}

const COPY: Readonly<Record<ProfileDecision | 'reactivate', DecisionCopy>> = {
  APROBADO: {
    action: 'Aprobar',
    heading: '¿Aprobar el perfil?',
    confirm: 'Sí, aprobar',
    explanation: 'El trabajador podrá ver pedidos de su zona y enviar ofertas.',
    done: 'Perfil aprobado.',
    destructive: false,
  },
  OBSERVADO: {
    action: 'Observar',
    heading: '¿Observar el perfil?',
    confirm: 'Sí, observar',
    explanation: 'El trabajador verá el motivo, podrá corregir su perfil y volver a enviarlo.',
    done: 'Perfil observado. El trabajador verá el motivo.',
    destructive: false,
  },
  RECHAZADO: {
    action: 'Rechazar',
    heading: '¿Rechazar el perfil?',
    confirm: 'Sí, rechazar',
    explanation: 'El trabajador verá el motivo. Puede corregir su perfil y volver a enviarlo.',
    done: 'Perfil rechazado. El trabajador verá el motivo.',
    destructive: true,
  },
  SUSPENDIDO: {
    action: 'Suspender',
    heading: '¿Suspender al trabajador?',
    confirm: 'Sí, suspender',
    explanation:
      'Dejará de recibir pedidos y de enviar ofertas, y se cancelará su solicitud de cambio de zona pendiente.',
    done: 'Trabajador suspendido.',
    destructive: true,
  },
  reactivate: {
    action: 'Reactivar',
    heading: '¿Reactivar al trabajador?',
    confirm: 'Sí, reactivar',
    explanation: 'Volverá a estar aprobado y a recibir pedidos.',
    done: 'Trabajador reactivado.',
    destructive: false,
  },
};

export function decisionCopy(
  decision: ProfileDecision,
  current: WorkerProfileStatus,
): DecisionCopy {
  return COPY[decision === 'APROBADO' && current === 'SUSPENDIDO' ? 'reactivate' : decision];
}

const CHANGED_ERROR = 'El perfil cambió de estado. Revise la información actualizada.';
/** El backend cita los estados con su literal interno («de APROBADO a OBSERVADO»). */
const RAW_TRANSITION = /de [A-Z]{5,} a [A-Z]{5,}/;

export function decisionErrorMessages(error: unknown, fallback: string): string[] {
  const messages = apiErrorMessages(error, fallback);
  return apiErrorStatus(error) === 409 && messages.some((message) => RAW_TRANSITION.test(message))
    ? [CHANGED_ERROR]
    : messages;
}

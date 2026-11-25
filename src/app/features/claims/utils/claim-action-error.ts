import { apiErrorMessages, apiErrorStatus } from '../../../shared/utils/api-error-message';

const CHANGED_ERROR = 'El reclamo cambió de estado. Revise la información actualizada.';
/** El backend nombra los estados con su literal interno («desde EN_REVISION», «(estado CERRADO)»). */
const RAW_STATUS = /desde [A-Z_]{4,}|estado [A-Z_]{4,}/;

/**
 * Mensajes de una acción rechazada sobre un reclamo: los del backend, salvo los conflictos de
 * estado que citan el literal interno.
 */
export function claimActionMessages(error: unknown, fallback: string): string[] {
  const messages = apiErrorMessages(error, fallback);
  return apiErrorStatus(error) === 409 && messages.some((message) => RAW_STATUS.test(message))
    ? [CHANGED_ERROR]
    : messages;
}

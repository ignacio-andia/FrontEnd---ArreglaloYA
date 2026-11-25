import { apiErrorMessages, apiErrorStatus } from '../../../shared/utils/api-error-message';

const CHANGED_ERROR = 'El pedido cambió de estado. Revise la información actualizada.';
/** El backend nombra el estado con su literal interno («… en estado EN_EJECUCION»). */
const RAW_STATUS = /en estado [A-Z_]{4,}/;

/**
 * Mensajes de una acción rechazada sobre el flujo de un trabajo: los del backend, salvo el
 * conflicto de estado, que no se muestra con el literal interno.
 */
export function actionErrorMessages(error: unknown, fallback: string): string[] {
  const messages = apiErrorMessages(error, fallback);
  return apiErrorStatus(error) === 409 && messages.some((message) => RAW_STATUS.test(message))
    ? [CHANGED_ERROR]
    : messages;
}

import { apiErrorMessages, apiErrorStatus } from '../../../shared/utils/api-error-message';
import { actionErrorMessages } from '../../workflow/utils/action-error';

/** Sin respuesta fiable no se sabe si la cancelación llegó a guardarse (no es idempotente). */
export const CANCELLATION_UNCONFIRMED =
  'No pudimos confirmar si se realizó la cancelación. Revise el estado actualizado antes de volver a intentarlo.';

export type CancellationFailure =
  /** El backend rechazó el motivo: se corrige en el campo, sin cerrar la confirmación. */
  | { kind: 'reason' }
  /** `stale`: hay que volver a consultar el pedido. */
  | { kind: 'rejected'; messages: string[]; stale: boolean };

/** Tratamiento de un fallo al cancelar (#51 y #90). Decide por el código HTTP. */
export function cancellationFailure(error: unknown, fallback: string): CancellationFailure {
  const status = apiErrorStatus(error);
  if (status === 400) {
    // La validación llega como lista, en parte en inglés: nunca se muestra tal cual.
    const onReason = apiErrorMessages(error, fallback).every((text) => text.startsWith('reason '));
    return onReason ? { kind: 'reason' } : { kind: 'rejected', messages: [fallback], stale: false };
  }
  if (status === null || status === 0 || status >= 500) {
    return { kind: 'rejected', messages: [CANCELLATION_UNCONFIRMED], stale: true };
  }
  return {
    kind: 'rejected',
    messages: actionErrorMessages(error, fallback),
    stale: status === 403 || status === 404 || status === 409,
  };
}

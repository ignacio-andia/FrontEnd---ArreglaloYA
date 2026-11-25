import { ValidatorFn } from '@angular/forms';
import { normalizeBudgetAmount } from '../../orders/validators/order.validators';

/** `visitCost`: 0 (gratis) o mayor, con la precisión del backend. */
export const VISIT_COST_PATTERN = /^\d{1,8}(?:\.\d{1,2})?$/;
/** Máximo de la columna del backend (no es una regla de negocio). */
export const MAX_DURATION_MINUTES = 2_147_483_647;
/** Las fechas se muestran y se escriben en hora de Bolivia (UTC−4, sin horario de verano). */
const BOLIVIA_OFFSET = '-04:00';

export const visitCost: ValidatorFn = (control) => {
  const value = typeof control.value === 'string' ? normalizeBudgetAmount(control.value) : '';
  return value === '' || VISIT_COST_PATTERN.test(value) ? null : { visitCost: true };
};

/** Valor de un `datetime-local` como ISO 8601 con zona horaria explícita. */
export function toBoliviaDateTime(local: string): string {
  return `${local.length === 16 ? `${local}:00` : local}${BOLIVIA_OFFSET}`;
}

/** La fecha propuesta debe ser futura (el backend lo comprueba con su reloj). */
export const futureDateTime: ValidatorFn = (control) => {
  const value = typeof control.value === 'string' ? control.value : '';
  if (value === '') {
    return null;
  }
  const time = Date.parse(toBoliviaDateTime(value));
  return Number.isNaN(time) || time <= Date.now() ? { future: true } : null;
};

export const durationMinutes: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (value === null || value === '') {
    return null;
  }
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= MAX_DURATION_MINUTES
    ? null
    : { duration: true };
};

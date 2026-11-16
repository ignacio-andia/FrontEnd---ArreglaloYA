import { ValidatorFn } from '@angular/forms';

/**
 * Restricciones de `CreateWorkerProfileDto` del backend. El backend sigue siendo la validación
 * definitiva (por ejemplo, que la zona y las categorías existan y estén activas).
 */
export const MIN_YEARS_OF_EXPERIENCE = 0;
export const MAX_YEARS_OF_EXPERIENCE = 70;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MIN_SPECIALTIES = 1;
export const MAX_SPECIALTIES = 10;

/** `@IsInt`: número entero (un valor vacío lo resuelve `Validators.required`). */
export const integer: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return typeof value === 'number' && Number.isInteger(value) ? null : { integer: true };
};

/**
 * `@ArrayMinSize` / `@ArrayMaxSize` sobre una lista de ids. La selección por casillas
 * garantiza que no haya repetidos (`@ArrayUnique`).
 */
export function selectionCount(min: number, max: number): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    const count = Array.isArray(value) ? value.length : 0;
    if (count < min) {
      return { minSelection: { min, actual: count } };
    }
    if (count > max) {
      return { maxSelection: { max, actual: count } };
    }
    return null;
  };
}

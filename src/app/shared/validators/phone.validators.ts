import { ValidatorFn } from '@angular/forms';
import { trimmedValue } from './text.validators';

/**
 * `PHONE_PATTERN` del backend (registro y actualización de la cuenta):
 * 7 a 15 dígitos, `+` opcional al inicio y sin empezar por 0. No admite espacios ni guiones.
 */
export const PHONE_PATTERN = /^\+?[1-9]\d{6,14}$/;

/** Teléfono opcional: vacío es válido; si se informa, debe cumplir `PHONE_PATTERN` tras recortar. */
export const optionalPhone: ValidatorFn = (control) => {
  const value = trimmedValue(control);
  return value === '' || PHONE_PATTERN.test(value) ? null : { phone: true };
};

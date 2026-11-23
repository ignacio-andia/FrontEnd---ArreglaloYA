import { AbstractControl, ValidatorFn } from '@angular/forms';

/**
 * Validadores de texto que reproducen el decorador `@Trim()` del backend:
 * el valor se recorta antes de validar.
 */

/** Valor del control recortado (cadena vacía si no es texto). */
export function trimmedValue(control: AbstractControl): string {
  return typeof control.value === 'string' ? control.value.trim() : '';
}

/** Obligatorio tras recortar espacios (`@Trim` + `@IsNotEmpty`). */
export const trimmedRequired: ValidatorFn = (control) =>
  trimmedValue(control).length > 0 ? null : { required: true };

/** Longitud máxima tras recortar espacios (`@Trim` + `@MaxLength`). */
export function trimmedMaxLength(maxLength: number): ValidatorFn {
  return (control) => {
    const length = trimmedValue(control).length;
    return length > maxLength
      ? { maxlength: { requiredLength: maxLength, actualLength: length } }
      : null;
  };
}

/**
 * Longitud mínima tras recortar espacios (`@Trim` + `@MinLength`). Un valor vacío no es error
 * aquí: la obligatoriedad la indica `trimmedRequired`.
 */
export function trimmedMinLength(minLength: number): ValidatorFn {
  return (control) => {
    const length = trimmedValue(control).length;
    return length > 0 && length < minLength
      ? { minlength: { requiredLength: minLength, actualLength: length } }
      : null;
  };
}

import {
  AbstractControl,
  FormControl,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

/**
 * Validadores que reproducen las restricciones de `RegisterDto` del backend.
 * El backend recorta (`@Trim`) nombre, apellido, correo y teléfono antes de validar;
 * la contraseña no se recorta. El backend sigue siendo la validación definitiva.
 */

/** Longitud máxima de la contraseña en bytes UTF-8 (bcrypt ignora el resto). */
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 255;

/** `PHONE_PATTERN` del backend: 7 a 15 dígitos, `+` opcional, sin empezar por 0. */
export const PHONE_PATTERN = /^\+?[1-9]\d{6,14}$/;

/** `@Matches(/(?=.*\p{L})(?=.*\d)/u)`: al menos una letra (cualquier alfabeto) y un dígito. */
const PASSWORD_LETTER_AND_DIGIT = /(?=.*\p{L})(?=.*\d)/u;

/** Dominio de nivel superior exigido por `@IsEmail()` (validator.js, `require_tld`). */
const EMAIL_TLD = /^([a-z¡-￿]{2,}|xn[a-z0-9-]{2,})$/i;

function trimmedValue(control: AbstractControl): string {
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

/** Correo válido tras recortar espacios (`@Trim` + `@IsEmail`), con dominio de nivel superior. */
export const trimmedEmail: ValidatorFn = (control) => {
  const value = trimmedValue(control);
  if (value === '') {
    return null;
  }

  const tld = value.slice(value.lastIndexOf('.') + 1);
  const domain = value.slice(value.lastIndexOf('@') + 1);
  const hasTld = domain.includes('.') && EMAIL_TLD.test(tld);

  return Validators.email(new FormControl(value)) === null && hasTld ? null : { email: true };
};

/** Contraseña: mínimo 8 caracteres, máximo 72 bytes UTF-8, al menos una letra y un número. */
export const passwordPolicy: ValidatorFn = (control) => {
  const value = typeof control.value === 'string' ? control.value : '';
  if (value === '') {
    return null;
  }

  const errors: ValidationErrors = {};
  if (value.length < PASSWORD_MIN_LENGTH) {
    errors['minlength'] = { requiredLength: PASSWORD_MIN_LENGTH, actualLength: value.length };
  }
  const bytes = new TextEncoder().encode(value).length;
  if (bytes > PASSWORD_MAX_BYTES) {
    errors['maxbytes'] = { maxBytes: PASSWORD_MAX_BYTES, actualBytes: bytes };
  }
  if (!PASSWORD_LETTER_AND_DIGIT.test(value)) {
    errors['letterAndDigit'] = true;
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

/** Teléfono opcional: vacío es válido; si se informa, debe cumplir `PHONE_PATTERN` tras recortar. */
export const optionalPhone: ValidatorFn = (control) => {
  const value = trimmedValue(control);
  return value === '' || PHONE_PATTERN.test(value) ? null : { phone: true };
};

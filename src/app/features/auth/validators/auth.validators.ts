import { FormControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { trimmedValue } from '../../../shared/validators/text.validators';

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

/** `@Matches(/(?=.*\p{L})(?=.*\d)/u)`: al menos una letra (cualquier alfabeto) y un dígito. */
const PASSWORD_LETTER_AND_DIGIT = /(?=.*\p{L})(?=.*\d)/u;

/** Dominio de nivel superior exigido por `@IsEmail()` (validator.js, `require_tld`). */
const EMAIL_TLD = /^([a-z\u00a1-\uffff]{2,}|xn[a-z0-9-]{2,})$/i;

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

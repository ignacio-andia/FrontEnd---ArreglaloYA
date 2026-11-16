import { AbstractControl } from '@angular/forms';

/** Mensaje propio para un campo rechazado por la validación del backend. */
export const SERVER_FIELD_MESSAGE = 'El servidor rechazó este dato. Revíselo e inténtelo de nuevo.';

/**
 * Marca un control con un error del servidor (`errors.server`). Angular lo elimina en cuanto
 * el usuario modifica el valor, porque vuelve a ejecutar los validadores.
 */
export function setServerError(control: AbstractControl, message: string): void {
  control.setErrors({ ...control.errors, server: message });
  control.markAsTouched();
}

/**
 * Asocia los mensajes de validación del backend (`"<campo> ..."`, a menudo en inglés según
 * class-validator) al control con ese nombre, usando un texto propio en español.
 * Devuelve los mensajes que no corresponden a ningún control del formulario.
 */
export function applyServerValidationErrors(
  form: { controls: Readonly<Record<string, AbstractControl>> },
  messages: readonly string[],
): string[] {
  const unmatched: string[] = [];

  for (const message of messages) {
    const field = Object.keys(form.controls).find((name) => message.startsWith(`${name} `));
    if (field === undefined) {
      unmatched.push(message);
    } else {
      setServerError(form.controls[field], SERVER_FIELD_MESSAGE);
    }
  }

  return unmatched;
}

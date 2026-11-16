import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  SERVER_FIELD_MESSAGE,
  applyServerValidationErrors,
  setServerError,
} from './server-validation';

describe('server validation helpers', () => {
  function form() {
    return new FormGroup({
      email: new FormControl('ana@example.com', { nonNullable: true }),
      password: new FormControl('x', { nonNullable: true, validators: [Validators.required] }),
    });
  }

  it('marks the control named at the start of each backend message', () => {
    const group = form();

    const unmatched = applyServerValidationErrors(group, ['email must be an email']);

    expect(unmatched).toEqual([]);
    expect(group.controls.email.errors).toEqual({ server: SERVER_FIELD_MESSAGE });
    expect(group.controls.email.touched).toBe(true);
    expect(group.controls.password.errors).toBeNull();
  });

  it('returns messages that do not belong to any control', () => {
    const group = form();

    const unmatched = applyServerValidationErrors(group, [
      'property roles should not exist',
      'emailAddress must be valid',
    ]);

    expect(unmatched).toEqual(['property roles should not exist', 'emailAddress must be valid']);
    expect(group.valid).toBe(true);
  });

  it('removes the server error when the value changes', () => {
    const group = form();
    setServerError(group.controls.email, 'El correo electrónico ya está registrado');

    group.controls.email.setValue('otra@example.com');

    expect(group.controls.email.errors).toBeNull();
  });
});

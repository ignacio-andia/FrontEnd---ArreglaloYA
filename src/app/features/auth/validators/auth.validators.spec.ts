import { FormControl } from '@angular/forms';
import { passwordPolicy, trimmedEmail } from './auth.validators';

const control = (value: string) => new FormControl(value);

describe('auth validators', () => {
  describe('trimmedEmail', () => {
    it.each(['ana@example.com', '  ana.perez@correo.com.bo  ', 'ana+servicios@example.org'])(
      'accepts %s',
      (value) => expect(trimmedEmail(control(value))).toBeNull(),
    );

    it.each(['ana', 'ana@', 'ana@example', 'ana@example.c', 'ana example@example.com'])(
      'rejects %s',
      (value) => expect(trimmedEmail(control(value))).toEqual({ email: true }),
    );

    it('leaves empty values to the required validator', () => {
      expect(trimmedEmail(control(''))).toBeNull();
    });
  });

  describe('passwordPolicy', () => {
    it.each(['Clave1234', 'contraseña1', '12345678ñ', 'clave con espacios 1'])(
      'accepts %s',
      (value) => expect(passwordPolicy(control(value))).toBeNull(),
    );

    it('requires at least 8 characters', () => {
      expect(passwordPolicy(control('Clave12'))).toEqual({
        minlength: { requiredLength: 8, actualLength: 7 },
      });
    });

    it('requires a letter and a number', () => {
      expect(passwordPolicy(control('abcdefgh'))).toEqual({ letterAndDigit: true });
      expect(passwordPolicy(control('12345678'))).toEqual({ letterAndDigit: true });
    });

    it('limits the length to 72 UTF-8 bytes, not characters', () => {
      expect(passwordPolicy(control(`a1${'b'.repeat(70)}`))).toBeNull();
      // 36 "ñ" ocupan 72 bytes; con "1" son 73.
      expect(passwordPolicy(control(`1${'ñ'.repeat(36)}`))).toEqual({
        maxbytes: { maxBytes: 72, actualBytes: 73 },
      });
    });

    it('does not trim spaces (they count)', () => {
      expect(passwordPolicy(control('  a1    '))).toBeNull();
    });
  });
});

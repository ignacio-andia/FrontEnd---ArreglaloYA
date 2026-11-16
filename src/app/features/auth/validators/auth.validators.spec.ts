import { FormControl } from '@angular/forms';
import {
  optionalPhone,
  passwordPolicy,
  trimmedEmail,
  trimmedMaxLength,
  trimmedRequired,
} from './auth.validators';

const control = (value: string) => new FormControl(value);

describe('auth validators', () => {
  describe('trimmedRequired', () => {
    it('rejects empty and whitespace-only values', () => {
      expect(trimmedRequired(control(''))).toEqual({ required: true });
      expect(trimmedRequired(control('   '))).toEqual({ required: true });
    });

    it('accepts a single character', () => {
      expect(trimmedRequired(control(' A '))).toBeNull();
    });
  });

  describe('trimmedMaxLength', () => {
    const max100 = trimmedMaxLength(100);

    it('accepts 100 characters, ignoring surrounding spaces', () => {
      expect(max100(control(`  ${'a'.repeat(100)}  `))).toBeNull();
    });

    it('rejects 101 characters', () => {
      expect(max100(control('a'.repeat(101)))).toEqual({
        maxlength: { requiredLength: 100, actualLength: 101 },
      });
    });
  });

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

  describe('optionalPhone', () => {
    it.each(['', '   ', '70000000', '+59170000000', '1234567', '123456789012345'])(
      'accepts "%s"',
      (value) => expect(optionalPhone(control(value))).toBeNull(),
    );

    it.each(['0123456', '123456', '1234567890123456', '+591 70000000', '7000-0000', 'abc1234'])(
      'rejects "%s"',
      (value) => expect(optionalPhone(control(value))).toEqual({ phone: true }),
    );
  });
});

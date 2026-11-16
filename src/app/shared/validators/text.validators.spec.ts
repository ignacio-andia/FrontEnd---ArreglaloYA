import { FormControl } from '@angular/forms';
import { trimmedMaxLength, trimmedRequired } from './text.validators';

const control = (value: string) => new FormControl(value);

describe('text validators', () => {
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
});

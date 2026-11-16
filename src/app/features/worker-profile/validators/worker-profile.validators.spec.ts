import { FormControl } from '@angular/forms';
import { integer, selectionCount } from './worker-profile.validators';

describe('worker profile validators', () => {
  describe('integer', () => {
    it.each([0, 5, 70])('accepts %s', (value) => {
      expect(integer(new FormControl(value))).toBeNull();
    });

    it.each([2.5, 0.1])('rejects %s', (value) => {
      expect(integer(new FormControl(value))).toEqual({ integer: true });
    });

    it('leaves empty values to the required validator', () => {
      expect(integer(new FormControl(null))).toBeNull();
    });
  });

  describe('selectionCount', () => {
    const oneToTen = selectionCount(1, 10);

    it('requires at least one id', () => {
      expect(oneToTen(new FormControl<string[]>([]))).toEqual({
        minSelection: { min: 1, actual: 0 },
      });
    });

    it('accepts between 1 and 10 ids', () => {
      expect(oneToTen(new FormControl(['a']))).toBeNull();
      expect(oneToTen(new FormControl(Array.from({ length: 10 }, (_, i) => `id-${i}`)))).toBeNull();
    });

    it('rejects more than 10 ids', () => {
      expect(oneToTen(new FormControl(Array.from({ length: 11 }, (_, i) => `id-${i}`)))).toEqual({
        maxSelection: { max: 10, actual: 11 },
      });
    });
  });
});

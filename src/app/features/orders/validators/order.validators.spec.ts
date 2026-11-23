import { FormControl } from '@angular/forms';
import {
  BUDGET_AMOUNT_PATTERN,
  ORDER_IMAGE_ACCEPT,
  ORDER_IMAGE_MAX_BYTES,
  budgetAmount,
  normalizeBudgetAmount,
  orderImageProblem,
  photoCount,
} from './order.validators';

function image(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('order validators', () => {
  describe('budget amount', () => {
    it.each(['150', '150.5', '150.50', '0.01', '12345678.99'])('accepts %s', (value) => {
      expect(BUDGET_AMOUNT_PATTERN.test(value)).toBe(true);
      expect(budgetAmount(new FormControl(value))).toBeNull();
    });

    it.each(['0', '0.00', '-5', '1.234', '123456789', 'abc', '15 0'])('rejects %s', (value) => {
      expect(budgetAmount(new FormControl(value))).toEqual({ budgetAmount: true });
    });

    it('converts a decimal comma into a point before validating and sending', () => {
      expect(normalizeBudgetAmount(' 150,50 ')).toBe('150.50');
      expect(budgetAmount(new FormControl('150,5'))).toBeNull();
      expect(normalizeBudgetAmount('1,234,5')).toBe('1,234,5');
    });

    it('leaves the empty value to the required validator', () => {
      expect(budgetAmount(new FormControl('  '))).toBeNull();
    });
  });

  describe('photoCount', () => {
    const validator = photoCount(1, 4);

    it('requires between 1 and 4 photos', () => {
      expect(validator(new FormControl([]))).toEqual({ minPhotos: { min: 1, actual: 0 } });
      expect(validator(new FormControl([image('a.jpg', 'image/jpeg')]))).toBeNull();
      const five = Array.from({ length: 5 }, (_, index) => image(`${index}.jpg`, 'image/jpeg'));
      expect(validator(new FormControl(five))).toEqual({ maxPhotos: { max: 4, actual: 5 } });
    });
  });

  describe('orderImageProblem', () => {
    it.each([
      ['foto.jpg', 'image/jpeg'],
      ['foto.JPEG', 'image/jpeg'],
      ['foto.png', 'image/png'],
      ['foto.webp', 'image/webp'],
      ['foto.webp', ''],
    ])('accepts %s (%s)', (name, type) => {
      expect(orderImageProblem(image(name, type))).toBeNull();
    });

    it.each([
      ['foto.heic', 'image/heic'],
      ['foto.gif', 'image/gif'],
      ['documento.pdf', 'application/pdf'],
      ['foto.jpg', 'application/pdf'],
    ])('rejects the format of %s (%s)', (name, type) => {
      expect(orderImageProblem(image(name, type))).toContain('Formatos aceptados: JPG, PNG y WebP');
    });

    it('rejects empty and too large files', () => {
      expect(orderImageProblem(image('vacia.jpg', 'image/jpeg', 0))).toBe('El archivo está vacío.');
      expect(orderImageProblem(image('grande.jpg', 'image/jpeg', ORDER_IMAGE_MAX_BYTES + 1))).toBe(
        'La fotografía supera el tamaño máximo de 10,0 MB.',
      );
    });

    it('lists the accepted types and extensions for the file picker', () => {
      expect(ORDER_IMAGE_ACCEPT).toBe('image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp');
    });
  });
});

import { ValidatorFn } from '@angular/forms';
import { formatFileSize } from '../../../shared/pipes/file-size.pipe';

/** Límites de `CreateOrderDto` (02-request-dtos) y de las fotografías (06-file-contracts). */
export const ORDER_DESCRIPTION_MIN_LENGTH = 10;
export const ORDER_DESCRIPTION_MAX_LENGTH = 2000;
export const ORDER_ADDRESS_MAX_LENGTH = 255;
export const ORDER_MIN_IMAGES = 1;
/** Máximo fijo de fotografías por pedido (T5.3: no es configurable). */
export const ORDER_MAX_IMAGES = 4;
/**
 * Tamaño máximo por fotografía: 10 MB (`ORDER_IMAGE_MAX_MB` del backend, que su `.env` no
 * redefine). Si cambia la configuración, el backend responde 413 con el límite vigente.
 */
export const ORDER_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** Longitud máxima del motivo de cancelación (`CancelOrderDto`). */
export const ORDER_CANCEL_REASON_MAX_LENGTH = 500;

/** Formatos que acepta el backend (detectados por el contenido real del archivo). */
export const ORDER_IMAGE_FORMATS = [
  { label: 'JPG', mimeType: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
  { label: 'PNG', mimeType: 'image/png', extensions: ['png'] },
  { label: 'WebP', mimeType: 'image/webp', extensions: ['webp'] },
] as const;

/** Valor del atributo `accept` del selector de fotografías. */
export const ORDER_IMAGE_ACCEPT = ORDER_IMAGE_FORMATS.flatMap((format) => [
  format.mimeType,
  ...format.extensions.map((extension) => `.${extension}`),
]).join(',');

/**
 * Patrón de `budgetAmount`: mayor que 0, hasta 8 dígitos enteros y 2 decimales, con punto.
 * Es el mismo `BUDGET_AMOUNT_PATTERN` del backend.
 */
export const BUDGET_AMOUNT_PATTERN = /^(?!0+(?:\.0{1,2})?$)\d{1,8}(?:\.\d{1,2})?$/;

/**
 * Monto tal como se envía: sin espacios y con punto decimal. Una coma decimal (`150,50`, habitual
 * en Bolivia) se convierte en punto; cualquier otro formato se deja igual para que no valide.
 */
export function normalizeBudgetAmount(value: string): string {
  const trimmed = value.trim();
  return /^\d+,\d{1,2}$/.test(trimmed) ? trimmed.replace(',', '.') : trimmed;
}

/** Valida el presupuesto ya normalizado. Vacío no es error aquí (lo cubre `trimmedRequired`). */
export const budgetAmount: ValidatorFn = (control) => {
  const value = typeof control.value === 'string' ? normalizeBudgetAmount(control.value) : '';
  return value === '' || BUDGET_AMOUNT_PATTERN.test(value) ? null : { budgetAmount: true };
};

/** Cantidad de fotografías del pedido entre `min` y `max`. */
export function photoCount(min: number, max: number): ValidatorFn {
  return (control) => {
    const count = Array.isArray(control.value) ? control.value.length : 0;
    if (count < min) {
      return { minPhotos: { min, actual: count } };
    }
    return count > max ? { maxPhotos: { max, actual: count } } : null;
  };
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/**
 * Validación previa de una fotografía (formato por extensión y tipo informado, tamaño). Devuelve
 * el motivo del rechazo, o `null` si se puede adjuntar. El backend vuelve a validar el contenido.
 */
export function orderImageProblem(file: File): string | null {
  if (file.size === 0) {
    return 'El archivo está vacío.';
  }
  const extension = extensionOf(file.name);
  const formatByExtension = ORDER_IMAGE_FORMATS.some((format) =>
    (format.extensions as readonly string[]).includes(extension),
  );
  const typeAllowed =
    file.type === '' || ORDER_IMAGE_FORMATS.some((format) => format.mimeType === file.type);
  if (!formatByExtension || !typeAllowed) {
    return 'Formato no permitido. Formatos aceptados: JPG, PNG y WebP.';
  }
  if (file.size > ORDER_IMAGE_MAX_BYTES) {
    return `La fotografía supera el tamaño máximo de ${formatFileSize(ORDER_IMAGE_MAX_BYTES)}.`;
  }
  return null;
}

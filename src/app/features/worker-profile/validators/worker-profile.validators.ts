import { AbstractControl, FormArray, ValidatorFn } from '@angular/forms';

/**
 * Restricciones de `CreateWorkerProfileDto` del backend. El backend sigue siendo la validación
 * definitiva (por ejemplo, que la zona y las categorías existan y estén activas).
 */
export const MIN_YEARS_OF_EXPERIENCE = 0;
export const MAX_YEARS_OF_EXPERIENCE = 70;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MIN_SPECIALTIES = 1;
export const MAX_SPECIALTIES = 10;

/** `@IsInt`: número entero (un valor vacío lo resuelve `Validators.required`). */
export const integer: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return typeof value === 'number' && Number.isInteger(value) ? null : { integer: true };
};

/**
 * `@ArrayMinSize` / `@ArrayMaxSize` sobre una lista de ids. La selección por casillas
 * garantiza que no haya repetidos (`@ArrayUnique`).
 */
export function selectionCount(min: number, max: number): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    const count = Array.isArray(value) ? value.length : 0;
    if (count < min) {
      return { minSelection: { min, actual: count } };
    }
    if (count > max) {
      return { maxSelection: { max, actual: count } };
    }
    return null;
  };
}

// ---------------------------------------------------------------------------------------------
// Horarios de atención (`ScheduleItemDto` y `normalizeSchedules` del backend)
// ---------------------------------------------------------------------------------------------

/** `TIME_PATTERN` del backend: `HH:mm` en 24 horas o `24:00`. */
export const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

/** `MAX_SCHEDULES` del backend. */
export const MAX_SCHEDULES = 50;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function readTime(group: AbstractControl, name: string): string | null {
  const value: unknown = group.get(name)?.value;
  return typeof value === 'string' && TIME_PATTERN.test(value) ? value : null;
}

/** Hora con formato `HH:mm` (un valor vacío lo resuelve `Validators.required`). */
export const timeFormat: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (value === null || value === '' || value === undefined) {
    return null;
  }
  return typeof value === 'string' && TIME_PATTERN.test(value) ? null : { timeFormat: true };
};

/**
 * Un horario: el fin debe ser posterior al inicio. `24:00` solo vale como fin
 * (09-gaps C1: el patrón lo admite como inicio, pero el backend lo rechaza después).
 */
export const scheduleRange: ValidatorFn = (group) => {
  const start = readTime(group, 'startTime');
  const end = readTime(group, 'endTime');
  if (start === '24:00') {
    return { startAtMidnightEnd: true };
  }
  if (start === null || end === null) {
    return null;
  }
  return toMinutes(end) > toMinutes(start) ? null : { endBeforeStart: true };
};

/**
 * Conjunto de horarios: como máximo 50 y sin superposiciones dentro del mismo día, estén
 * activos o no (misma regla que `normalizeSchedules`). Devuelve los cruces encontrados.
 */
export const schedulesSet: ValidatorFn = (array) => {
  if (!(array instanceof FormArray)) {
    return null;
  }
  if (array.length > MAX_SCHEDULES) {
    return { maxSchedules: { max: MAX_SCHEDULES, actual: array.length } };
  }

  const byDay = new Map<string, { start: number; end: number; label: string }[]>();
  for (const group of array.controls) {
    const day: unknown = group.get('dayOfWeek')?.value;
    const start = readTime(group, 'startTime');
    const end = readTime(group, 'endTime');
    if (typeof day !== 'string' || day === '' || start === null || end === null) {
      continue;
    }
    if (toMinutes(end) <= toMinutes(start)) {
      continue;
    }
    const ranges = byDay.get(day) ?? [];
    ranges.push({ start: toMinutes(start), end: toMinutes(end), label: `${start}-${end}` });
    byDay.set(day, ranges);
  }

  const overlaps: { day: string; first: string; second: string }[] = [];
  for (const [day, ranges] of byDay) {
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start < sorted[i - 1].end) {
        overlaps.push({ day, first: sorted[i - 1].label, second: sorted[i].label });
      }
    }
  }
  return overlaps.length > 0 ? { overlap: overlaps } : null;
};

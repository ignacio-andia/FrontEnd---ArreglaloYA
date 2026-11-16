import { FormArray, FormControl, FormGroup } from '@angular/forms';
import {
  integer,
  scheduleRange,
  schedulesSet,
  selectionCount,
  timeFormat,
} from './worker-profile.validators';

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

  describe('schedules', () => {
    function row(dayOfWeek: string, startTime: string, endTime: string, isActive = true) {
      return new FormGroup({
        dayOfWeek: new FormControl(dayOfWeek),
        startTime: new FormControl(startTime),
        endTime: new FormControl(endTime),
        isActive: new FormControl(isActive),
      });
    }

    it.each(['00:00', '08:30', '23:59', '24:00', ''])('accepts the time "%s"', (value) => {
      expect(timeFormat(new FormControl(value))).toBeNull();
    });

    it.each(['8:00', '24:01', '12:60', '25:00', '08:00:00'])('rejects the time "%s"', (value) => {
      expect(timeFormat(new FormControl(value))).toEqual({ timeFormat: true });
    });

    it('requires the end to be after the start', () => {
      expect(scheduleRange(row('LUNES', '08:00', '12:00'))).toBeNull();
      expect(scheduleRange(row('LUNES', '18:00', '24:00'))).toBeNull();
      expect(scheduleRange(row('LUNES', '10:00', '09:00'))).toEqual({ endBeforeStart: true });
      expect(scheduleRange(row('LUNES', '10:00', '10:00'))).toEqual({ endBeforeStart: true });
    });

    it('allows 24:00 only as the end', () => {
      expect(scheduleRange(row('LUNES', '24:00', '24:00'))).toEqual({ startAtMidnightEnd: true });
    });

    it('detects overlaps on the same day, active or not', () => {
      const array = new FormArray([
        row('LUNES', '08:00', '12:00'),
        row('LUNES', '11:00', '14:00', false),
        row('MARTES', '08:00', '12:00'),
      ]);

      expect(schedulesSet(array)).toEqual({
        overlap: [{ day: 'LUNES', first: '08:00-12:00', second: '11:00-14:00' }],
      });
    });

    it('accepts contiguous ranges and different days', () => {
      const array = new FormArray([
        row('LUNES', '08:00', '12:00'),
        row('LUNES', '12:00', '16:00'),
        row('MARTES', '08:00', '12:00'),
      ]);

      expect(schedulesSet(array)).toBeNull();
    });

    it('limits the set to 50 schedules', () => {
      const array = new FormArray(Array.from({ length: 51 }, () => row('', '', '')));

      expect(schedulesSet(array)).toEqual({ maxSchedules: { max: 50, actual: 51 } });
    });
  });
});

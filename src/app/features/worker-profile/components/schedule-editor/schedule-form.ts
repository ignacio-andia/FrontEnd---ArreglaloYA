import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  Validators,
} from '@angular/forms';
import { WeekDay, isWeekDay } from '../../models/week-day.model';
import { Schedule, ScheduleItemRequest } from '../../models/worker-profile.model';
import {
  scheduleRange,
  schedulesSet,
  timeFormat,
} from '../../validators/worker-profile.validators';

/** Fila editable de un horario de atención. `dayOfWeek` vacío = sin elegir. */
export type ScheduleFormGroup = FormGroup<{
  dayOfWeek: FormControl<WeekDay | ''>;
  startTime: FormControl<string>;
  endTime: FormControl<string>;
  isActive: FormControl<boolean>;
}>;

export type ScheduleFormArray = FormArray<ScheduleFormGroup>;

export function createScheduleGroup(
  fb: NonNullableFormBuilder,
  value: Partial<Pick<Schedule, 'dayOfWeek' | 'startTime' | 'endTime' | 'isActive'>> = {},
): ScheduleFormGroup {
  return fb.group(
    {
      dayOfWeek: fb.control<WeekDay | ''>(value.dayOfWeek ?? '', [Validators.required]),
      startTime: fb.control(value.startTime ?? '', [Validators.required, timeFormat]),
      endTime: fb.control(value.endTime ?? '', [Validators.required, timeFormat]),
      isActive: fb.control(value.isActive ?? true),
    },
    { validators: [scheduleRange] },
  );
}

/** Lista de horarios con la validación del conjunto (máximo y superposiciones). */
export function createScheduleArray(
  fb: NonNullableFormBuilder,
  schedules: readonly Schedule[] = [],
): ScheduleFormArray {
  return fb.array(
    schedules.map((schedule) => createScheduleGroup(fb, schedule)),
    { validators: [schedulesSet] },
  );
}

/** Cuerpo de los horarios (`ScheduleItemDto[]`) a partir de filas ya validadas. */
export function toScheduleRequests(array: ScheduleFormArray): ScheduleItemRequest[] {
  const requests: ScheduleItemRequest[] = [];
  for (const group of array.controls) {
    const { dayOfWeek, startTime, endTime, isActive } = group.getRawValue();
    if (isWeekDay(dayOfWeek)) {
      requests.push({ dayOfWeek, startTime, endTime, isActive });
    }
  }
  return requests;
}

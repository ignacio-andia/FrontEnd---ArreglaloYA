import { Component, ElementRef, Injector, afterNextRender, inject, input } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { WEEK_DAYS, WEEK_DAY_LABELS, isWeekDay } from '../../models/week-day.model';
import { MAX_SCHEDULES } from '../../validators/worker-profile.validators';
import { ScheduleFormArray, ScheduleFormGroup, createScheduleGroup } from './schedule-form';

/**
 * Editor de horarios de atención. Trabaja sobre el `FormArray` del formulario que lo contiene
 * (agrega y quita filas) y muestra los errores de cada fila y del conjunto.
 */
@Component({
  selector: 'app-schedule-editor',
  imports: [ReactiveFormsModule],
  templateUrl: './schedule-editor.component.html',
  styleUrl: './schedule-editor.component.scss',
})
export class ScheduleEditorComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly schedules = input.required<ScheduleFormArray>();
  /** Muestra los errores aunque el usuario no haya tocado las filas (tras intentar enviar). */
  readonly submitted = input(false);
  readonly idPrefix = input('schedule');
  readonly disabled = input(false);

  protected readonly weekDays = WEEK_DAYS;
  protected readonly dayLabels = WEEK_DAY_LABELS;
  protected readonly maxSchedules = MAX_SCHEDULES;

  protected add(): void {
    const array = this.schedules();
    if (array.length >= MAX_SCHEDULES) {
      return;
    }
    array.push(createScheduleGroup(this.fb));
    const index = array.length - 1;
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>(`#${this.idPrefix()}-day-${index}`)
          ?.focus(),
      { injector: this.injector },
    );
  }

  protected remove(index: number): void {
    const array = this.schedules();
    array.removeAt(index);
    array.markAsDirty();
  }

  /** Errores visibles de una fila, ya traducidos. */
  protected rowErrors(group: ScheduleFormGroup): string[] {
    if (!(group.touched || this.submitted()) || group.valid) {
      return [];
    }
    const messages: string[] = [];
    const { dayOfWeek, startTime, endTime } = group.controls;
    if (dayOfWeek.hasError('required')) {
      messages.push('Elija el día.');
    }
    if (startTime.hasError('required')) {
      messages.push('Ingrese la hora de inicio.');
    } else if (startTime.hasError('timeFormat')) {
      messages.push('La hora de inicio debe tener el formato HH:mm.');
    }
    if (endTime.hasError('required')) {
      messages.push('Ingrese la hora de fin.');
    } else if (endTime.hasError('timeFormat')) {
      messages.push('La hora de fin debe tener el formato HH:mm.');
    }
    if (group.hasError('startAtMidnightEnd')) {
      messages.push('24:00 solo puede usarse como hora de fin.');
    }
    if (group.hasError('endBeforeStart')) {
      messages.push('La hora de fin debe ser posterior a la de inicio.');
    }
    return messages;
  }

  /** Errores del conjunto (superposiciones en un mismo día, máximo de horarios). */
  protected setErrors(): string[] {
    const array = this.schedules();
    if (!(array.touched || array.dirty || this.submitted())) {
      return [];
    }
    const messages: string[] = [];
    const overlaps: unknown = array.errors?.['overlap'];
    if (Array.isArray(overlaps)) {
      for (const overlap of overlaps as { day: string; first: string; second: string }[]) {
        const day = isWeekDay(overlap.day) ? WEEK_DAY_LABELS[overlap.day] : overlap.day;
        messages.push(`${day}: el horario ${overlap.second} se superpone con ${overlap.first}.`);
      }
    }
    if (array.hasError('maxSchedules')) {
      messages.push(`Puede registrar como máximo ${MAX_SCHEDULES} horarios.`);
    }
    return messages;
  }
}

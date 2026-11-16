import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder } from '@angular/forms';
import { ScheduleEditorComponent } from './schedule-editor.component';
import { ScheduleFormArray, createScheduleArray, toScheduleRequests } from './schedule-form';

describe('ScheduleEditorComponent', () => {
  let fixture: ComponentFixture<ScheduleEditorComponent>;
  let element: HTMLElement;
  let schedules: ScheduleFormArray;

  beforeEach(() => {
    schedules = createScheduleArray(TestBed.inject(NonNullableFormBuilder));
    fixture = TestBed.createComponent(ScheduleEditorComponent);
    fixture.componentRef.setInput('schedules', schedules);
    fixture.componentRef.setInput('idPrefix', 'test');
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  function button(text: string): HTMLButtonElement {
    const found = Array.from(element.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(text),
    );
    if (!found) {
      throw new Error(`${text} not found`);
    }
    return found;
  }

  function set(id: string, value: string): void {
    const field = element.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
    if (!field) {
      throw new Error(`${id} not found`);
    }
    field.value = value;
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
    field.dispatchEvent(new Event('blur'));
  }

  it('starts empty and adds labelled rows', () => {
    expect(element.textContent).toContain('No hay horarios registrados.');

    button('Agregar horario').click();
    fixture.detectChanges();

    expect(schedules.length).toBe(1);
    expect(element.querySelector('legend')?.textContent).toContain('Horario 1');
    expect(element.querySelector('label[for="test-day-0"]')?.textContent).toContain('Día');
  });

  it('builds the ScheduleItemDto list from valid rows', () => {
    button('Agregar horario').click();
    fixture.detectChanges();
    set('test-day-0', 'MIERCOLES');
    set('test-start-0', '08:00');
    set('test-end-0', '12:00');

    expect(schedules.valid).toBe(true);
    expect(toScheduleRequests(schedules)).toEqual([
      { dayOfWeek: 'MIERCOLES', startTime: '08:00', endTime: '12:00', isActive: true },
    ]);
  });

  it('shows row and overlap errors', () => {
    button('Agregar horario').click();
    button('Agregar horario').click();
    fixture.detectChanges();
    set('test-day-0', 'LUNES');
    set('test-start-0', '10:00');
    set('test-end-0', '09:00');
    set('test-day-1', 'LUNES');
    set('test-start-1', '08:00');
    set('test-end-1', '12:00');
    fixture.detectChanges();

    expect(element.textContent).toContain('La hora de fin debe ser posterior a la de inicio.');

    set('test-start-0', '11:00');
    set('test-end-0', '13:00');
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Lunes: el horario 11:00-13:00 se superpone con 08:00-12:00.',
    );
  });

  it('removes a row', () => {
    button('Agregar horario').click();
    fixture.detectChanges();

    button('Quitar').click();
    fixture.detectChanges();

    expect(schedules.length).toBe(0);
  });
});

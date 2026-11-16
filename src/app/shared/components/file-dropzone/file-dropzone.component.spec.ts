import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileDropzoneComponent } from './file-dropzone.component';

describe('FileDropzoneComponent', () => {
  let fixture: ComponentFixture<FileDropzoneComponent>;
  let element: HTMLElement;
  let emitted: File[][];

  beforeEach(() => {
    fixture = TestBed.createComponent(FileDropzoneComponent);
    fixture.componentRef.setInput('accept', '.pdf');
    element = fixture.nativeElement as HTMLElement;
    emitted = [];
    fixture.componentInstance.filesSelected.subscribe((files) => emitted.push(files));
    fixture.detectChanges();
  });

  function zone(): HTMLElement {
    const found = element.querySelector<HTMLElement>('.dropzone');
    if (!found) {
      throw new Error('dropzone not found');
    }
    return found;
  }

  function dragEvent(type: string, files: File[] = []): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { files, dropEffect: 'none' } });
    return event;
  }

  const file = new File(['%PDF-1.4'], 'cedula.pdf', { type: 'application/pdf' });

  it('emits the files chosen with the button, without uploading them', () => {
    const picker = element.querySelector<HTMLInputElement>('input[type="file"]');
    expect(picker?.hidden).toBe(true);
    expect(picker?.accept).toBe('.pdf');
    expect(picker?.multiple).toBe(true);
    if (!picker) {
      return;
    }
    Object.defineProperty(picker, 'files', { value: [file], configurable: true });

    picker.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([[file]]);
  });

  it('highlights the zone while dragging and emits the dropped files', () => {
    zone().dispatchEvent(dragEvent('dragenter'));
    fixture.detectChanges();
    expect(zone().classList).toContain('dropzone--active');

    const drop = dragEvent('drop', [file]);
    zone().dispatchEvent(drop);
    fixture.detectChanges();

    expect(drop.defaultPrevented).toBe(true);
    expect(zone().classList).not.toContain('dropzone--active');
    expect(emitted).toEqual([[file]]);
  });

  it('ignores files while disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    zone().dispatchEvent(dragEvent('drop', [file]));

    expect(emitted).toEqual([]);
    expect(element.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true);
  });
});

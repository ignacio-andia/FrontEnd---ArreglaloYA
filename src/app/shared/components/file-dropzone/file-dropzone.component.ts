import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';

/**
 * Zona para elegir archivos: se pueden arrastrar desde el explorador o elegir con el botón
 * (alternativa accesible con teclado). Solo emite los archivos elegidos; no los sube.
 * El texto de ayuda se proyecta como contenido.
 */
@Component({
  selector: 'app-file-dropzone',
  template: `
    <div
      class="dropzone"
      [class.dropzone--active]="dragging()"
      [class.dropzone--disabled]="disabled()"
      (dragenter)="onDragEnter($event)"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave()"
      (drop)="onDrop($event)"
    >
      <p class="dropzone__title">Arrastre aquí sus archivos</p>
      <p class="dropzone__or">o</p>
      <button
        type="button"
        class="dropzone__button"
        [disabled]="disabled()"
        [attr.aria-describedby]="hintId()"
        (click)="openPicker()"
      >
        {{ buttonLabel() }}
      </button>
      <div class="dropzone__hint" [id]="hintId()"><ng-content /></div>
      <input
        #picker
        type="file"
        hidden
        [accept]="accept()"
        [multiple]="multiple()"
        (change)="onPickerChange($event)"
      />
    </div>
  `,
  styleUrl: './file-dropzone.component.scss',
})
export class FileDropzoneComponent {
  readonly accept = input('');
  readonly multiple = input(true);
  readonly disabled = input(false);
  readonly buttonLabel = input('Seleccionar archivos');
  readonly hintId = input('dropzone-hint');

  /** Archivos elegidos (arrastrados o seleccionados). */
  readonly filesSelected = output<File[]>();

  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');
  protected readonly dragging = signal(false);
  /** Cuenta las entradas y salidas de elementos hijos para no parpadear al arrastrar. */
  private dragDepth = 0;

  protected openPicker(): void {
    if (!this.disabled()) {
      this.picker().nativeElement.click();
    }
  }

  protected onPickerChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    this.emit(target.files);
    // Permite volver a elegir el mismo archivo después de quitarlo.
    target.value = '';
  }

  protected onDragEnter(event: DragEvent): void {
    event.preventDefault();
    if (this.disabled()) {
      return;
    }
    this.dragDepth++;
    this.dragging.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    // Necesario para que el navegador permita soltar en la zona.
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = this.disabled() ? 'none' : 'copy';
    }
  }

  protected onDragLeave(): void {
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) {
      this.dragging.set(false);
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = 0;
    this.dragging.set(false);
    if (!this.disabled()) {
      this.emit(event.dataTransfer?.files ?? null);
    }
  }

  private emit(files: FileList | null): void {
    const list = files ? Array.from(files) : [];
    if (list.length > 0) {
      this.filesSelected.emit(this.multiple() ? list : list.slice(0, 1));
    }
  }
}

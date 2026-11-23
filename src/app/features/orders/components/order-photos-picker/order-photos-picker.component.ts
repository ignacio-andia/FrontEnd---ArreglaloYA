import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FileDropzoneComponent } from '../../../../shared/components/file-dropzone/file-dropzone.component';
import { FileSizePipe, formatFileSize } from '../../../../shared/pipes/file-size.pipe';
import { PhotoPreviewService } from '../../services/photo-preview.service';
import {
  ORDER_IMAGE_ACCEPT,
  ORDER_IMAGE_MAX_BYTES,
  ORDER_MAX_IMAGES,
  orderImageProblem,
} from '../../validators/order.validators';

interface RejectedPhoto {
  name: string;
  reason: string;
}

/**
 * Fotografías del pedido, como control de Reactive Forms (`formControlName`, valor `File[]`).
 * Se eligen o arrastran, se previsualizan y se pueden quitar antes de publicar. No sube nada:
 * los archivos se envían junto con el pedido. Valida formato y tamaño como ayuda; el backend
 * vuelve a validar el contenido. Requiere `PhotoPreviewService` en un inyector superior.
 */
@Component({
  selector: 'app-order-photos-picker',
  imports: [FileDropzoneComponent, FileSizePipe],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OrderPhotosPickerComponent),
      multi: true,
    },
  ],
  templateUrl: './order-photos-picker.component.html',
  styleUrl: './order-photos-picker.component.scss',
})
export class OrderPhotosPickerComponent implements ControlValueAccessor {
  private readonly previews = inject(PhotoPreviewService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** Id del texto de ayuda de la zona de selección. */
  readonly hintId = input('order-photos-hint');

  protected readonly accept = ORDER_IMAGE_ACCEPT;
  protected readonly max = ORDER_MAX_IMAGES;
  protected readonly maxSize = formatFileSize(ORDER_IMAGE_MAX_BYTES);

  protected readonly files = signal<readonly File[]>([]);
  protected readonly rejected = signal<readonly RejectedPhoto[]>([]);
  protected readonly disabled = signal(false);
  protected readonly full = computed(() => this.files().length >= ORDER_MAX_IMAGES);
  protected readonly items = computed(() =>
    this.files().map((file) => ({ file, url: this.previews.urlFor(file) })),
  );

  private onChange: (files: File[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: unknown): void {
    const files = Array.isArray(value)
      ? value.filter((item): item is File => item instanceof File)
      : [];
    this.files.set(files);
    this.rejected.set([]);
    this.previews.keepOnly(files);
  }

  registerOnChange(fn: (files: File[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected add(selected: File[]): void {
    const accepted: File[] = [];
    const rejected: RejectedPhoto[] = [];
    for (const file of selected) {
      const problem =
        orderImageProblem(file) ??
        (this.isRepeated(file, accepted) ? 'Esta fotografía ya está agregada.' : null) ??
        (this.files().length + accepted.length >= ORDER_MAX_IMAGES
          ? `Se alcanzó el máximo de ${ORDER_MAX_IMAGES} fotografías.`
          : null);
      if (problem === null) {
        accepted.push(file);
      } else {
        rejected.push({ name: file.name, reason: problem });
      }
    }
    this.rejected.set(rejected);
    if (accepted.length > 0) {
      this.update([...this.files(), ...accepted]);
    }
    this.onTouched();
  }

  protected remove(index: number): void {
    const files = this.files().filter((_, position) => position !== index);
    this.rejected.set([]);
    this.update(files);
    this.onTouched();
    // El botón pulsado desaparece: el foco pasa a la siguiente foto o a la zona de selección.
    afterNextRender(
      () => {
        const buttons = this.host.nativeElement.querySelectorAll<HTMLElement>('.photos__remove');
        const target =
          buttons.item(Math.min(index, buttons.length - 1)) ??
          this.host.nativeElement.querySelector<HTMLElement>('.dropzone__button');
        target?.focus();
      },
      { injector: this.injector },
    );
  }

  private update(files: readonly File[]): void {
    this.files.set(files);
    this.previews.keepOnly(files);
    this.onChange([...files]);
  }

  /** Mismo archivo elegido dos veces (nombre, tamaño y fecha de modificación). */
  private isRepeated(file: File, pending: readonly File[]): boolean {
    return [...this.files(), ...pending].some(
      (other) =>
        other.name === file.name &&
        other.size === file.size &&
        other.lastModified === file.lastModified,
    );
  }
}

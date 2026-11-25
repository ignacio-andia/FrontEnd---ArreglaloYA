import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, concatMap, finalize, from, tap } from 'rxjs';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FileSizePipe } from '../../../../shared/pipes/file-size.pipe';
import { apiErrorMessages, apiErrorStatus } from '../../../../shared/utils/api-error-message';
import { OrderImage, OwnerOrder } from '../../models/order.model';
import { OrdersApiService } from '../../services/orders-api.service';
import { PhotoPreviewService } from '../../services/photo-preview.service';
import {
  ORDER_IMAGE_ACCEPT,
  ORDER_MAX_IMAGES,
  ORDER_MIN_IMAGES,
  orderImageProblem,
} from '../../validators/order.validators';
import { OrderPhotoComponent } from '../order-photo/order-photo.component';
import { OrderPhotosPickerComponent } from '../order-photos-picker/order-photos-picker.component';

interface Replacement {
  image: OrderImage;
  file: File;
  url: string | null;
}

type Operation = 'upload' | 'replace' | 'delete';

const UPLOAD_ERROR = 'No se pudo subir la fotografía.';
const REPLACE_ERROR = 'No se pudo reemplazar la fotografía.';
const DELETE_ERROR = 'No se pudo quitar la fotografía.';

/**
 * Fotografías de un pedido editable: ver, agregar (hasta 4), reemplazar y quitar. Cada cambio se
 * envía al momento, con vista previa y confirmación, y el pedido mostrado es siempre el que
 * devuelve el backend. Ante un 404 o un 409 se avisa con `stale` para volver a consultarlo. El
 * backend valida el contenido de cada archivo; aquí solo se anticipan formato y tamaño.
 */
@Component({
  selector: 'app-order-photo-manager',
  imports: [
    ReactiveFormsModule,
    ConfirmDialogComponent,
    FileSizePipe,
    OrderPhotoComponent,
    OrderPhotosPickerComponent,
  ],
  providers: [PhotoPreviewService],
  templateUrl: './order-photo-manager.component.html',
  styleUrl: './order-photo-manager.component.scss',
})
export class OrderPhotoManagerComponent {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly previews = inject(PhotoPreviewService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly replacePicker =
    viewChild.required<ElementRef<HTMLInputElement>>('replacePicker');

  readonly order = input.required<OwnerOrder>();
  /** El backend aceptó un cambio: pedido actualizado. */
  readonly changed = output<OwnerOrder>();
  /** El pedido mostrado puede estar desactualizado. */
  readonly stale = output();

  protected readonly accept = ORDER_IMAGE_ACCEPT;
  protected readonly max = ORDER_MAX_IMAGES;

  protected readonly count = computed(() => this.order().images.length);
  protected readonly remaining = computed(() => Math.max(0, ORDER_MAX_IMAGES - this.count()));
  protected readonly canDelete = computed(() => this.count() > ORDER_MIN_IMAGES);

  /** Fotografías elegidas para agregar; todavía no se enviaron. */
  protected readonly queue = new FormControl<File[]>([], { nonNullable: true });
  protected readonly busy = signal<Operation | null>(null);
  protected readonly errors = signal<string[]>([]);
  protected readonly statusMessage = signal<string | null>(null);
  protected readonly replacement = signal<Replacement | null>(null);
  protected readonly deleting = signal<OrderImage | null>(null);

  private replaceCandidate: OrderImage | null = null;

  protected upload(): void {
    const files = this.queue.value.slice(0, this.remaining());
    if (this.busy() !== null || files.length === 0) {
      return;
    }
    const orderId = this.order().id;
    let uploaded = 0;
    this.start('upload');
    from(files)
      .pipe(
        // Un archivo por petición y en orden; el primer fallo detiene el resto.
        concatMap((file) =>
          this.ordersApi.addImage(orderId, file).pipe(
            tap((order) => {
              uploaded++;
              // Ya está registrada: sale de la selección y no se vuelve a enviar.
              this.queue.setValue(this.queue.value.filter((queued) => queued !== file));
              this.changed.emit(order);
            }),
          ),
        ),
        finalize(() => this.busy.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: (error: unknown) => {
          this.fail(error, UPLOAD_ERROR);
          if (uploaded > 0) {
            this.statusMessage.set(
              `Se agregaron ${uploaded} de ${files.length} fotografías. Las demás siguen en la lista.`,
            );
          }
        },
        complete: () =>
          this.succeed(
            uploaded === 1 ? 'Se agregó 1 fotografía.' : `Se agregaron ${uploaded} fotografías.`,
          ),
      });
  }

  protected chooseReplacement(image: OrderImage): void {
    if (this.busy() !== null) {
      return;
    }
    this.replaceCandidate = image;
    this.errors.set([]);
    this.replacePicker().nativeElement.click();
  }

  protected onReplacementPicked(event: Event): void {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.item(0) ?? null;
    const image = this.replaceCandidate;
    if (input) {
      input.value = '';
    }
    if (!file || !image) {
      return;
    }
    const problem = orderImageProblem(file);
    if (problem !== null) {
      this.errors.set([`${file.name}: ${problem}`]);
      return;
    }
    this.statusMessage.set(null);
    this.replacement.set({ image, file, url: this.previews.urlFor(file) });
    this.focusAfterRender('#order-photos-replacement');
  }

  protected cancelReplacement(): void {
    if (this.busy() === null) {
      this.replacement.set(null);
    }
  }

  protected confirmReplacement(): void {
    const target = this.replacement();
    if (this.busy() !== null || target === null) {
      return;
    }
    this.run(
      'replace',
      this.ordersApi.replaceImage(this.order().id, target.image.id, target.file),
      'La fotografía se reemplazó.',
      REPLACE_ERROR,
      () => this.replacement.set(null),
    );
  }

  protected confirmDelete(): void {
    const image = this.deleting();
    if (this.busy() !== null || image === null) {
      return;
    }
    this.run(
      'delete',
      this.ordersApi.deleteImage(this.order().id, image.id),
      'La fotografía se quitó del pedido.',
      DELETE_ERROR,
      () => this.deleting.set(null),
    );
  }

  private run(
    operation: Operation,
    request: Observable<OwnerOrder>,
    success: string,
    fallback: string,
    close: () => void,
  ): void {
    this.start(operation);
    request
      .pipe(
        finalize(() => this.busy.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (order) => {
          close();
          this.changed.emit(order);
          this.succeed(success);
        },
        error: (error: unknown) => {
          close();
          this.fail(error, fallback);
        },
      });
  }

  private start(operation: Operation): void {
    this.busy.set(operation);
    this.errors.set([]);
    this.statusMessage.set(null);
  }

  private succeed(message: string): void {
    this.statusMessage.set(message);
    this.focusAfterRender('#order-photos-status');
  }

  private fail(error: unknown, fallback: string): void {
    this.errors.set(apiErrorMessages(error, fallback));
    const status = apiErrorStatus(error);
    if (status === 404 || status === 409) {
      this.stale.emit();
    }
    this.focusAfterRender('#order-photos-error');
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}

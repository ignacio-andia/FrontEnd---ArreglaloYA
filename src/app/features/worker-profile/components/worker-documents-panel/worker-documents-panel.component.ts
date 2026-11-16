import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, concatMap, finalize, from, map, of } from 'rxjs';
import { FileDownloadService } from '../../../../core/services/file-download.service';
import { FileDropzoneComponent } from '../../../../shared/components/file-dropzone/file-dropzone.component';
import { FileSizePipe } from '../../../../shared/pipes/file-size.pipe';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import {
  DOCUMENT_MAX_BYTES,
  WORKER_DOCUMENT_TYPES,
  WORKER_DOCUMENT_TYPE_LABELS,
  WorkerDocument,
  WorkerDocumentType,
  isWorkerDocumentType,
} from '../../models/worker-document.model';
import { WorkerDocumentsApiService } from '../../services/worker-documents-api.service';
import {
  DOCUMENT_ACCEPT,
  documentFileProblem,
  documentFormatLabel,
} from '../../validators/worker-document.validators';

/** Archivo elegido que todavía no se envió (solo existe en memoria del navegador). */
interface QueuedDocument {
  id: number;
  file: File;
  type: WorkerDocumentType | '';
  status: 'pending' | 'uploading' | 'failed';
  error: string | null;
}

interface UploadResult {
  uploaded: string[];
  failed: string[];
}

interface DocumentMessage {
  documentId: string;
  message: string;
}

const LIST_ERROR = 'No se pudieron cargar sus documentos.';
const UPLOAD_ERROR = 'No se pudo subir el documento.';
const DOWNLOAD_ERROR = 'No se pudo descargar el documento.';
const REPLACE_ERROR = 'No se pudo reemplazar el documento.';

/**
 * Documentos de respaldo del trabajador (RF-07).
 *
 * - Los archivos elegidos (arrastrados o seleccionados) quedan en una cola en memoria; se
 *   pueden quitar y no se envía nada hasta pulsar «Enviar documentación».
 * - Cada archivo se sube con su propia petición, en orden. Los que se suben salen de la cola;
 *   los que fallan quedan en ella con su motivo para reintentar. Nunca se reenvía un archivo
 *   que ya se subió. Un documento registrado no se puede eliminar (no hay endpoint).
 * - Los documentos registrados se descargan como Blob con el token y se pueden reemplazar
 *   (la versión anterior queda en el historial) mientras el perfil sea editable.
 */
@Component({
  selector: 'app-worker-documents-panel',
  imports: [DatePipe, FileSizePipe, FileDropzoneComponent],
  templateUrl: './worker-documents-panel.component.html',
  styleUrl: './worker-documents-panel.component.scss',
})
export class WorkerDocumentsPanelComponent {
  private readonly documentsApi = inject(WorkerDocumentsApiService);
  private readonly fileDownload = inject(FileDownloadService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly replacePicker = viewChild<ElementRef<HTMLInputElement>>('replacePicker');

  /** El perfil admite subir y reemplazar (BORRADOR u OBSERVADO, `canEdit` del backend). */
  readonly canEdit = input.required<boolean>();
  /** Estado visible del perfil, para explicar por qué no se puede editar. */
  readonly statusLabel = input('');

  protected readonly accept = DOCUMENT_ACCEPT;
  protected readonly maxBytes = DOCUMENT_MAX_BYTES;
  protected readonly documentTypes = WORKER_DOCUMENT_TYPES;
  protected readonly typeLabels = WORKER_DOCUMENT_TYPE_LABELS;
  protected readonly timezone = DISPLAY_TIMEZONE;
  protected readonly formatLabel = documentFormatLabel;

  // --- Documentos registrados -----------------------------------------------------------

  protected readonly documents = rxResource({ stream: () => this.documentsApi.list() });

  protected readonly documentsError = computed(() => {
    const error = this.documents.error();
    return error === undefined ? null : apiErrorMessages(error, LIST_ERROR).join(' ');
  });

  // --- Cola temporal -------------------------------------------------------------------

  private nextId = 0;
  protected readonly queue = signal<QueuedDocument[]>([]);
  protected readonly rejected = signal<{ name: string; reason: string }[]>([]);
  protected readonly uploading = signal(false);
  protected readonly uploadResult = signal<UploadResult | null>(null);
  protected readonly confirmAttempted = signal(false);

  protected readonly missingType = computed(() => this.queue().some((item) => item.type === ''));

  protected readonly resultMessage = computed(() => {
    const result = this.uploadResult();
    if (result === null) {
      return null;
    }
    const total = result.uploaded.length + result.failed.length;
    if (result.failed.length === 0) {
      return result.uploaded.length === 1
        ? 'Se subió 1 documento correctamente.'
        : `Se subieron ${result.uploaded.length} documentos correctamente.`;
    }
    if (result.uploaded.length === 0) {
      return 'No se pudo subir ningún documento. Revise los motivos en la lista y vuelva a intentarlo.';
    }
    return (
      `Se subieron ${result.uploaded.length} de ${total} documentos. ` +
      `Los ${result.failed.length} que fallaron siguen en la lista para reintentar; ` +
      'los que ya se subieron quedaron registrados y no se pueden quitar.'
    );
  });

  protected addFiles(files: File[]): void {
    if (this.uploading() || !this.canEdit()) {
      return;
    }
    const accepted: QueuedDocument[] = [];
    const rejected: { name: string; reason: string }[] = [];
    for (const file of files) {
      const problem = documentFileProblem(file);
      if (problem === null) {
        accepted.push({ id: this.nextId++, file, type: '', status: 'pending', error: null });
      } else {
        rejected.push({ name: file.name, reason: problem });
      }
    }
    this.rejected.set(rejected);
    this.uploadResult.set(null);
    if (accepted.length > 0) {
      this.queue.update((queue) => [...queue, ...accepted]);
    }
  }

  protected removeFromQueue(id: number): void {
    if (this.uploading()) {
      return;
    }
    this.queue.update((queue) => queue.filter((item) => item.id !== id));
  }

  protected setType(id: number, event: Event): void {
    const value = event.target instanceof HTMLSelectElement ? event.target.value : '';
    const type = isWorkerDocumentType(value) ? value : '';
    this.queue.update((queue) => queue.map((item) => (item.id === id ? { ...item, type } : item)));
  }

  /** Confirmación explícita: sube cada archivo de la cola con una petición independiente. */
  protected sendAll(): void {
    if (this.uploading() || !this.canEdit() || this.queue().length === 0) {
      return;
    }
    this.confirmAttempted.set(true);
    if (this.missingType()) {
      this.focusAfterRender('.queue__type[aria-invalid="true"]');
      return;
    }

    const items = this.queue().filter(
      (item): item is QueuedDocument & { type: WorkerDocumentType } => item.type !== '',
    );
    const result: UploadResult = { uploaded: [], failed: [] };
    this.uploading.set(true);
    this.uploadResult.set(null);
    this.rejected.set([]);

    from(items)
      .pipe(
        concatMap((item) => {
          this.updateItem(item.id, { status: 'uploading', error: null });
          return this.documentsApi.upload(item.type, item.file).pipe(
            map(() => ({ item, error: null as string | null })),
            catchError((error: unknown) =>
              of({ item, error: apiErrorMessages(error, UPLOAD_ERROR).join(' ') }),
            ),
          );
        }),
        finalize(() => this.uploading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ item, error }) => {
          if (error === null) {
            // Ya está registrado en el backend: sale de la cola y no se vuelve a enviar.
            this.queue.update((queue) => queue.filter((queued) => queued.id !== item.id));
            result.uploaded.push(item.file.name);
          } else {
            this.updateItem(item.id, { status: 'failed', error });
            result.failed.push(item.file.name);
          }
        },
        complete: () => {
          this.uploadResult.set(result);
          if (result.uploaded.length > 0) {
            this.documents.reload();
          }
          this.focusAfterRender('#documents-upload-result');
        },
      });
  }

  // --- Descarga ------------------------------------------------------------------------

  protected readonly downloadingId = signal<string | null>(null);
  protected readonly downloadError = signal<DocumentMessage | null>(null);

  protected download(document: WorkerDocument): void {
    if (this.downloadingId() !== null) {
      return;
    }
    this.downloadingId.set(document.id);
    this.downloadError.set(null);
    this.documentsApi
      .download(document.id)
      .pipe(
        finalize(() => this.downloadingId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (blob) => this.fileDownload.saveBlob(blob, document.originalName),
        error: (error: unknown) =>
          this.downloadError.set({
            documentId: document.id,
            message: apiErrorMessages(error, DOWNLOAD_ERROR).join(' '),
          }),
      });
  }

  // --- Reemplazo -----------------------------------------------------------------------

  private replaceCandidate: WorkerDocument | null = null;
  protected readonly replaceTarget = signal<{ document: WorkerDocument; file: File } | null>(null);
  protected readonly replacingId = signal<string | null>(null);
  protected readonly replaceError = signal<DocumentMessage | null>(null);
  protected readonly replaceMessage = signal<string | null>(null);

  protected chooseReplacement(document: WorkerDocument): void {
    if (this.replacingId() !== null || !this.canEdit()) {
      return;
    }
    this.replaceCandidate = document;
    this.replaceError.set(null);
    this.replaceMessage.set(null);
    this.replacePicker()?.nativeElement.click();
  }

  protected onReplacementPicked(event: Event): void {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.item(0) ?? null;
    const document = this.replaceCandidate;
    if (input) {
      input.value = '';
    }
    if (!file || !document) {
      return;
    }
    const problem = documentFileProblem(file);
    if (problem !== null) {
      this.replaceError.set({ documentId: document.id, message: `${file.name}: ${problem}` });
      return;
    }
    this.replaceTarget.set({ document, file });
  }

  protected cancelReplace(): void {
    if (this.replacingId() === null) {
      this.replaceTarget.set(null);
    }
  }

  protected confirmReplace(): void {
    const target = this.replaceTarget();
    if (!target || this.replacingId() !== null) {
      return;
    }
    this.replacingId.set(target.document.id);
    this.replaceError.set(null);
    this.documentsApi
      .replace(target.document.id, target.file)
      .pipe(
        finalize(() => this.replacingId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.replaceTarget.set(null);
          this.replaceMessage.set(
            `Se reemplazó «${target.document.originalName}». La versión anterior queda en el historial.`,
          );
          this.documents.reload();
        },
        error: (error: unknown) =>
          this.replaceError.set({
            documentId: target.document.id,
            message: apiErrorMessages(error, REPLACE_ERROR).join(' '),
          }),
      });
  }

  protected retryList(): void {
    this.documents.reload();
  }

  private updateItem(id: number, changes: Partial<QueuedDocument>): void {
    this.queue.update((queue) =>
      queue.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}

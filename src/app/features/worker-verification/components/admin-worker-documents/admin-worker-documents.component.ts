import { DOCUMENT, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';
import { FileDownloadService } from '../../../../core/services/file-download.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { FileSizePipe } from '../../../../shared/pipes/file-size.pipe';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import {
  WORKER_DOCUMENT_TYPE_LABELS,
  WorkerDocument,
} from '../../../worker-profile/models/worker-document.model';
import { AdminWorkerProfilesApiService } from '../../services/admin-worker-profiles-api.service';

const LIST_ERROR = 'No se pudieron consultar los documentos.';
const VIEW_ERROR = 'No se pudo abrir el documento.';
const DOWNLOAD_ERROR = 'No se pudo descargar el documento.';

interface Preview {
  name: string;
  url: string;
  image: boolean;
}

/**
 * Documentos de un trabajador para el administrador. Se consultan solo al pedirlo, porque cada
 * acceso queda registrado en la bitácora. El contenido se muestra con una URL `blob:` temporal.
 * El componente pertenece a un solo perfil: la página lo recrea al cambiar de perfil.
 */
@Component({
  selector: 'app-admin-worker-documents',
  imports: [
    DatePipe,
    FileSizePipe,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
  ],
  templateUrl: './admin-worker-documents.component.html',
  styleUrl: './admin-worker-documents.component.scss',
})
export class AdminWorkerDocumentsComponent {
  private readonly profilesApi = inject(AdminWorkerProfilesApiService);
  private readonly downloads = inject(FileDownloadService);
  private readonly urlApi = inject(DOCUMENT).defaultView?.URL;
  private readonly destroyRef = inject(DestroyRef);

  readonly profileId = input.required<string>();

  protected readonly typeLabels = WORKER_DOCUMENT_TYPE_LABELS;
  protected readonly timezone = DISPLAY_TIMEZONE;

  protected readonly requested = signal(false);
  protected readonly documents = rxResource({
    params: () => (this.requested() ? this.profileId() : undefined),
    stream: ({ params }) => this.profilesApi.getDocuments(params),
  });
  protected readonly listError = computed(() => {
    const error = this.documents.error();
    return error === undefined ? null : apiErrorMessages(error, LIST_ERROR).join(' ');
  });

  /** Documento en curso de apertura o descarga. */
  protected readonly busy = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly preview = signal<Preview | null>(null);

  /** URL `blob:` de la vista previa. */
  private currentUrl: string | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.revoke());
  }

  protected view(document: WorkerDocument): void {
    this.run(
      document,
      this.profilesApi.viewDocument(this.profileId(), document.id),
      VIEW_ERROR,
      (blob) => {
        this.revoke();
        if (!this.urlApi) {
          return;
        }
        // El tipo lo detecta el backend por el contenido; se fija para que el navegador no adivine.
        this.currentUrl = this.urlApi.createObjectURL(
          new Blob([blob], { type: document.mimeType }),
        );
        this.preview.set({
          name: document.originalName,
          url: this.currentUrl,
          image: document.mimeType.startsWith('image/'),
        });
      },
    );
  }

  protected download(document: WorkerDocument): void {
    this.run(
      document,
      this.profilesApi.downloadDocument(this.profileId(), document.id),
      DOWNLOAD_ERROR,
      (blob) => this.downloads.saveBlob(blob, document.originalName),
    );
  }

  protected closePreview(): void {
    this.revoke();
    this.preview.set(null);
  }

  private run(
    document: WorkerDocument,
    request: Observable<Blob>,
    fallback: string,
    done: (blob: Blob) => void,
  ): void {
    if (this.busy() !== null) {
      return;
    }
    this.busy.set(document.id);
    this.actionError.set(null);
    request
      .pipe(
        finalize(() => this.busy.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: done,
        error: (error: unknown) =>
          this.actionError.set(apiErrorMessages(error, fallback).join(' ')),
      });
  }

  /** Libera la URL temporal vigente. */
  private revoke(): void {
    if (this.currentUrl !== null) {
      this.urlApi?.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }
}

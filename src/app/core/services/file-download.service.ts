import { DOCUMENT } from '@angular/common';
import { Service, inject } from '@angular/core';

/**
 * Guarda en el equipo un archivo descargado como Blob con HttpClient (las descargas protegidas
 * necesitan el token Bearer, que `<a href>` e `<img src>` no envían). El nombre se recibe del
 * llamador (por ejemplo, `originalName`), porque el backend no expone `Content-Disposition`.
 */
@Service()
export class FileDownloadService {
  private readonly document = inject(DOCUMENT);

  saveBlob(blob: Blob, fileName: string): void {
    const view = this.document.defaultView;
    if (!view) {
      return;
    }

    const url = view.URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    this.document.body.appendChild(anchor);
    try {
      anchor.click();
    } finally {
      anchor.remove();
      // Se libera en la tarea siguiente: revocar en el mismo ciclo cancela la descarga en
      // algunos navegadores.
      view.setTimeout(() => view.URL.revokeObjectURL(url));
    }
  }
}

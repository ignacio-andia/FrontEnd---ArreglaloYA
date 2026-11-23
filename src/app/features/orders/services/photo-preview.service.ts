import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';

/**
 * URLs locales (`blob:`) para previsualizar fotografías antes de subirlas. Se provee en la página
 * que las usa, para que el selector y el resumen compartan la misma URL de cada archivo, y libera
 * todas las URLs cuando esa página se destruye. Nada se envía al servidor.
 */
@Injectable()
export class PhotoPreviewService {
  private readonly urlApi = inject(DOCUMENT).defaultView?.URL;
  private readonly urls = new Map<File, string>();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.keepOnly([]));
  }

  /** URL de previsualización del archivo, o `null` si el navegador no permite crearla. */
  urlFor(file: File): string | null {
    const existing = this.urls.get(file);
    if (existing !== undefined) {
      return existing;
    }
    if (typeof this.urlApi?.createObjectURL !== 'function') {
      return null;
    }
    const url = this.urlApi.createObjectURL(file);
    this.urls.set(file, url);
    return url;
  }

  /** Libera las URLs de los archivos que ya no se usan. */
  keepOnly(files: readonly File[]): void {
    for (const [file, url] of this.urls) {
      if (!files.includes(file)) {
        this.urlApi?.revokeObjectURL(url);
        this.urls.delete(file);
      }
    }
  }
}

import { Pipe, PipeTransform } from '@angular/core';

/** Tamaño legible de un archivo en bytes, por ejemplo `512 B`, `120,5 KB` o `1,2 MB`. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1).replace('.', ',')} KB`;
  }
  return `${(kilobytes / 1024).toFixed(1).replace('.', ',')} MB`;
}

@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
  transform(bytes: number): string {
    return formatFileSize(bytes);
  }
}

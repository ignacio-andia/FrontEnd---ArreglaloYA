import { localFile, workerDocument } from '../testing/worker-profile.fixtures';
import {
  DOCUMENT_ACCEPT,
  documentFileProblem,
  documentFormatLabel,
} from './worker-document.validators';

const MB = 1024 * 1024;

describe('worker document validators', () => {
  it.each([
    ['cedula.pdf', 'application/pdf'],
    ['foto.JPG', 'image/jpeg'],
    ['foto.jpeg', 'image/jpeg'],
    ['captura.png', 'image/png'],
    ['sin-tipo.pdf', ''],
  ])('accepts %s', (name, type) => {
    expect(documentFileProblem(localFile(name, type))).toBeNull();
  });

  it.each([
    ['documento.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['foto.webp', 'image/webp'],
    ['foto.heic', 'image/heic'],
    ['sin-extension', 'application/pdf'],
    ['falso.pdf', 'text/plain'],
  ])('rejects the format of %s', (name, type) => {
    expect(documentFileProblem(localFile(name, type))).toBe(
      'Formato no permitido. Formatos aceptados: PDF, JPG y PNG.',
    );
  });

  it('accepts exactly 5 MB and rejects larger files', () => {
    expect(documentFileProblem(localFile('limite.pdf', 'application/pdf', 5 * MB))).toBeNull();
    expect(documentFileProblem(localFile('grande.pdf', 'application/pdf', 5 * MB + 1))).toBe(
      'El archivo supera el tamaño máximo de 5,0 MB.',
    );
  });

  it('rejects empty files', () => {
    expect(documentFileProblem(localFile('vacio.pdf', 'application/pdf', 0))).toBe(
      'El archivo está vacío.',
    );
  });

  it('labels the format of local files and registered documents', () => {
    expect(documentFormatLabel(localFile('a.png', 'image/png'))).toBe('PNG');
    expect(documentFormatLabel(localFile('a.jpg', ''))).toBe('JPG');
    expect(documentFormatLabel(workerDocument({ mimeType: 'image/jpeg' }))).toBe('JPG');
  });

  it('limits the file picker to PDF, JPG and PNG', () => {
    expect(DOCUMENT_ACCEPT).toBe('application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png');
  });
});

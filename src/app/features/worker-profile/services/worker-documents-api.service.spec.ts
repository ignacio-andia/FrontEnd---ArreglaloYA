import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SessionStore } from '../../../core/auth/session.store';
import { apiUrl } from '../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { NormalizedApiError } from '../../../core/models/api-error.model';
import { localFile, userWithRoles, workerDocument } from '../testing/worker-profile.fixtures';
import { WorkerDocumentsApiService } from './worker-documents-api.service';

const DOCUMENTS_URL = apiUrl('worker-profile', 'me', 'documents');
const DOCUMENT_ID = workerDocument().id;

describe('WorkerDocumentsApiService', () => {
  let service: WorkerDocumentsApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    TestBed.inject(SessionStore).setSession({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      user: userWithRoles(['CLIENTE', 'TRABAJADOR']),
    });
    service = TestBed.inject(WorkerDocumentsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
  });

  it('lists the registered documents with the token', async () => {
    const result = firstValueFrom(service.list());

    const req = httpTesting.expectOne(DOCUMENTS_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    req.flush([workerDocument()]);

    expect(await result).toEqual([workerDocument()]);
  });

  it('uploads one file as multipart/form-data with only the type and file fields', () => {
    const file = localFile('cedula.pdf', 'application/pdf');

    service.upload('IDENTIDAD', file).subscribe();

    const req = httpTesting.expectOne(DOCUMENTS_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeInstanceOf(FormData);
    const form = req.request.body as FormData;
    expect([...form.keys()]).toEqual(['type', 'file']);
    expect(form.get('type')).toBe('IDENTIDAD');
    expect((form.get('file') as File).name).toBe('cedula.pdf');
    // El navegador fija Content-Type con el boundary: no se define a mano.
    expect(req.request.headers.has('Content-Type')).toBe(false);
    req.flush(workerDocument(), { status: 201, statusText: 'Created' });
  });

  it('replaces a document sending only the file field', () => {
    const file = localFile('cedula-nueva.png', 'image/png');

    service.replace(DOCUMENT_ID, file).subscribe();

    const req = httpTesting.expectOne(`${DOCUMENTS_URL}/${DOCUMENT_ID}/replace`);
    expect(req.request.method).toBe('POST');
    const form = req.request.body as FormData;
    expect([...form.keys()]).toEqual(['file']);
    expect(req.request.headers.has('Content-Type')).toBe(false);
    req.flush(workerDocument({ id: 'nuevo', originalName: 'cedula-nueva.png' }), {
      status: 201,
      statusText: 'Created',
    });
  });

  it('downloads a document as a Blob with the token', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    const result = firstValueFrom(service.download(DOCUMENT_ID));

    const req = httpTesting.expectOne(`${DOCUMENTS_URL}/${DOCUMENT_ID}/download`);
    expect(req.request.responseType).toBe('blob');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    req.flush(blob);

    expect(await result).toBe(blob);
  });

  it('propagates backend errors such as 413 with their message', async () => {
    const result = firstValueFrom(
      service.upload('CERTIFICADO', localFile('grande.pdf', 'application/pdf')),
    ).catch((error: unknown) => error);

    httpTesting.expectOne(DOCUMENTS_URL).flush(
      {
        statusCode: 413,
        message: 'El archivo supera el tamaño máximo permitido de 5 MB',
        error: 'Payload Too Large',
      },
      { status: 413, statusText: 'Payload Too Large' },
    );

    expect(await result).toEqual<NormalizedApiError>({
      statusCode: 413,
      messages: ['El archivo supera el tamaño máximo permitido de 5 MB'],
      error: 'Payload Too Large',
    });
  });
});

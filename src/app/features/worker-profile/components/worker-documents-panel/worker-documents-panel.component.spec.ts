import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../../core/interceptors/auth.interceptor';
import { FileDownloadService } from '../../../../core/services/file-download.service';
import { FileDropzoneComponent } from '../../../../shared/components/file-dropzone/file-dropzone.component';
import { WorkerDocument } from '../../models/worker-document.model';
import { localFile, userWithRoles, workerDocument } from '../../testing/worker-profile.fixtures';
import { WorkerDocumentsPanelComponent } from './worker-documents-panel.component';

const DOCUMENTS_URL = apiUrl('worker-profile', 'me', 'documents');
const MB = 1024 * 1024;

describe('WorkerDocumentsPanelComponent', () => {
  let fixture: ComponentFixture<WorkerDocumentsPanelComponent>;
  let element: HTMLElement;
  let httpTesting: HttpTestingController;
  const saveBlob = vi.fn();

  function render(canEdit = true): void {
    sessionStorage.clear();
    saveBlob.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: FileDownloadService, useValue: { saveBlob } },
      ],
    });
    TestBed.inject(SessionStore).setSession({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      user: userWithRoles(['CLIENTE', 'TRABAJADOR']),
    });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WorkerDocumentsPanelComponent);
    fixture.componentRef.setInput('canEdit', canEdit);
    fixture.componentRef.setInput('statusLabel', canEdit ? 'Borrador' : 'Pendiente de revisión');
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  function pending(url: string): Promise<TestRequest> {
    return vi.waitFor(() => httpTesting.expectOne(url));
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function loadDocuments(documents: WorkerDocument[] = []): Promise<void> {
    (await pending(DOCUMENTS_URL)).flush(documents);
    await settle();
  }

  function selectFiles(files: File[]): void {
    fixture.debugElement
      .query(By.directive(FileDropzoneComponent))
      .triggerEventHandler('filesSelected', files);
    fixture.detectChanges();
  }

  function queueItems(): HTMLElement[] {
    return Array.from(element.querySelectorAll<HTMLElement>('.queue__item'));
  }

  function chooseType(index: number, value: string): void {
    const select = queueItems()[index]?.querySelector<HTMLSelectElement>('select');
    if (!select) {
      throw new Error(`select ${index} not found`);
    }
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function button(text: string, root: ParentNode = element): HTMLButtonElement {
    const found = Array.from(root.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(text),
    );
    if (!found) {
      throw new Error(`${text} not found`);
    }
    return found;
  }

  function uploadRequests(): TestRequest[] {
    return httpTesting.match((req) => req.method === 'POST' && req.url === DOCUMENTS_URL);
  }

  describe('registered documents', () => {
    it('lists current and replaced documents without delete actions', async () => {
      render();
      await loadDocuments([
        workerDocument({ id: 'nuevo', originalName: 'cedula-2026.pdf' }),
        workerDocument({
          id: 'viejo',
          originalName: 'cedula-2020.pdf',
          replacedAt: '2026-11-16T10:00:00.000Z',
          replacedById: 'nuevo',
        }),
      ]);

      const items = Array.from(element.querySelectorAll('.registered__item'));
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toContain('cedula-2026.pdf');
      expect(items[0].textContent).toContain('Vigente');
      expect(items[0].textContent).toContain('PDF');
      expect(items[1].textContent).toContain('Reemplazado el');
      expect(items[1].textContent).not.toContain('Reemplazar');
      const labels = Array.from(element.querySelectorAll('button')).map((b) => b.textContent ?? '');
      expect(labels.some((label) => /eliminar|borrar/i.test(label))).toBe(false);
    });

    it('shows an empty state and a load error with retry', async () => {
      render();
      await loadDocuments([]);
      expect(element.textContent).toContain('Todavía no registró documentos.');
    });
  });

  describe('temporary queue', () => {
    beforeEach(async () => {
      render();
      await loadDocuments();
    });

    it('starts empty and keeps the selected files only in memory', () => {
      expect(element.textContent).toContain('No hay archivos seleccionados.');

      selectFiles([localFile('cedula.pdf', 'application/pdf', 2 * MB)]);

      expect(queueItems()).toHaveLength(1);
      expect(queueItems()[0].textContent).toContain('cedula.pdf');
      expect(queueItems()[0].textContent).toContain('PDF');
      expect(queueItems()[0].textContent).toContain('2,0 MB');
      expect(uploadRequests()).toHaveLength(0);
    });

    it('rejects files with an invalid format or size, explaining why', () => {
      selectFiles([
        localFile('foto.webp', 'image/webp'),
        localFile('grande.pdf', 'application/pdf', 5 * MB + 1),
        localFile('ok.png', 'image/png'),
      ]);

      expect(queueItems()).toHaveLength(1);
      const alert = element.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('foto.webp: Formato no permitido');
      expect(alert?.textContent).toContain('grande.pdf: El archivo supera el tamaño máximo');
    });

    it('removes files from the queue before sending', () => {
      selectFiles([localFile('a.pdf', 'application/pdf'), localFile('b.pdf', 'application/pdf')]);

      button('Quitar', queueItems()[0]).click();
      fixture.detectChanges();

      expect(queueItems()).toHaveLength(1);
      expect(queueItems()[0].textContent).toContain('b.pdf');
      expect(uploadRequests()).toHaveLength(0);
    });

    it('requires a document type for every file before uploading', () => {
      selectFiles([localFile('a.pdf', 'application/pdf')]);

      button('Enviar documentación').click();
      fixture.detectChanges();

      expect(uploadRequests()).toHaveLength(0);
      expect(queueItems()[0].textContent).toContain('Elija el tipo de documento.');
      expect(queueItems()[0].querySelector('select')?.getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('upload', () => {
    beforeEach(async () => {
      render();
      await loadDocuments();
    });

    it('sends each file in its own request, in order, after the explicit confirmation', async () => {
      selectFiles([
        localFile('cedula.pdf', 'application/pdf'),
        localFile('titulo.png', 'image/png'),
      ]);
      chooseType(0, 'IDENTIDAD');
      chooseType(1, 'CERTIFICADO');
      expect(uploadRequests()).toHaveLength(0);

      button('Enviar documentación').click();
      fixture.detectChanges();

      const first = await pending(DOCUMENTS_URL);
      const firstForm = first.request.body as FormData;
      expect(firstForm.get('type')).toBe('IDENTIDAD');
      expect((firstForm.get('file') as File).name).toBe('cedula.pdf');
      // Mientras se envía, la cola no se puede modificar.
      fixture.detectChanges();
      expect(button('Quitar', queueItems()[1]).disabled).toBe(true);
      expect(button('Enviando documentación').disabled).toBe(true);
      first.flush(workerDocument(), { status: 201, statusText: 'Created' });

      const second = await pending(DOCUMENTS_URL);
      expect((second.request.body as FormData).get('type')).toBe('CERTIFICADO');
      second.flush(workerDocument({ id: 'otro', type: 'CERTIFICADO' }), {
        status: 201,
        statusText: 'Created',
      });

      await loadDocuments([workerDocument(), workerDocument({ id: 'otro', type: 'CERTIFICADO' })]);
      expect(queueItems()).toHaveLength(0);
      expect(element.querySelector('#documents-upload-result')?.textContent).toContain(
        'Se subieron 2 documentos correctamente.',
      );
      expect(element.querySelectorAll('.registered__item')).toHaveLength(2);
    });

    it('reports a partial upload and retries only the files that failed', async () => {
      selectFiles([
        localFile('a.pdf', 'application/pdf'),
        localFile('b.pdf', 'application/pdf'),
        localFile('c.pdf', 'application/pdf'),
      ]);
      chooseType(0, 'IDENTIDAD');
      chooseType(1, 'ANTECEDENTES');
      chooseType(2, 'REFERENCIA');

      button('Enviar documentación').click();
      fixture.detectChanges();
      (await pending(DOCUMENTS_URL)).flush(workerDocument(), {
        status: 201,
        statusText: 'Created',
      });
      (await pending(DOCUMENTS_URL)).flush(
        {
          statusCode: 400,
          message: 'Formato de archivo no permitido. Formatos aceptados: PDF, JPG, PNG',
          error: 'Bad Request',
        },
        { status: 400, statusText: 'Bad Request' },
      );
      (await pending(DOCUMENTS_URL)).flush(workerDocument({ id: 'c', type: 'REFERENCIA' }), {
        status: 201,
        statusText: 'Created',
      });
      await loadDocuments([workerDocument(), workerDocument({ id: 'c', type: 'REFERENCIA' })]);

      expect(queueItems()).toHaveLength(1);
      expect(queueItems()[0].textContent).toContain('b.pdf');
      expect(queueItems()[0].textContent).toContain('No se subió: Formato de archivo no permitido');
      const result = element.querySelector('#documents-upload-result');
      expect(result?.getAttribute('role')).toBe('alert');
      expect(result?.textContent).toContain('Se subieron 2 de 3 documentos');
      expect(result?.textContent).toContain('no se pueden quitar');

      button('Enviar documentación').click();
      fixture.detectChanges();
      const retry = await pending(DOCUMENTS_URL);
      expect((retry.request.body as FormData).get('type')).toBe('ANTECEDENTES');
      expect(((retry.request.body as FormData).get('file') as File).name).toBe('b.pdf');
      retry.flush(workerDocument({ id: 'b', type: 'ANTECEDENTES' }), {
        status: 201,
        statusText: 'Created',
      });
      await loadDocuments();
      expect(uploadRequests()).toHaveLength(0);
      expect(queueItems()).toHaveLength(0);
    });

    it('reports when no file could be uploaded and does not reload the list', async () => {
      selectFiles([localFile('a.pdf', 'application/pdf')]);
      chooseType(0, 'IDENTIDAD');
      button('Enviar documentación').click();
      fixture.detectChanges();

      (await pending(DOCUMENTS_URL)).flush(
        {
          statusCode: 409,
          message: 'No se puede modificar el perfil en estado PENDIENTE',
          error: 'Conflict',
        },
        { status: 409, statusText: 'Conflict' },
      );
      await settle();

      expect(element.querySelector('#documents-upload-result')?.textContent).toContain(
        'No se pudo subir ningún documento',
      );
      expect(queueItems()[0].textContent).toContain(
        'No se puede modificar el perfil en estado PENDIENTE',
      );
      httpTesting.expectNone((req) => req.method === 'GET');
    });
  });

  describe('download and replacement', () => {
    beforeEach(async () => {
      render();
      await loadDocuments([workerDocument()]);
    });

    it('downloads as a Blob and saves it with the original name', async () => {
      button('Descargar').click();
      fixture.detectChanges();
      expect(button('Descargando').disabled).toBe(true);

      const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const req = await pending(`${DOCUMENTS_URL}/${workerDocument().id}/download`);
      expect(req.request.responseType).toBe('blob');
      req.flush(blob);
      await settle();

      expect(saveBlob).toHaveBeenCalledWith(blob, 'cedula.pdf');
    });

    it('shows download errors next to the document', async () => {
      button('Descargar').click();
      fixture.detectChanges();

      const errorBody = new Blob(
        [
          JSON.stringify({
            statusCode: 404,
            message: 'El documento no existe',
            error: 'Not Found',
          }),
        ],
        { type: 'application/json' },
      );
      (await pending(`${DOCUMENTS_URL}/${workerDocument().id}/download`)).flush(errorBody, {
        status: 404,
        statusText: 'Not Found',
      });
      await settle();

      expect(element.querySelector('.registered__item [role="alert"]')?.textContent).toContain(
        'El documento no existe',
      );
      expect(saveBlob).not.toHaveBeenCalled();
    });

    function pickReplacement(file: File): void {
      button('Reemplazar').click();
      const picker = element.querySelectorAll<HTMLInputElement>('input[type="file"]');
      const replacePicker = picker[picker.length - 1];
      Object.defineProperty(replacePicker, 'files', {
        value: { item: () => file, length: 1 },
        configurable: true,
      });
      replacePicker.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }

    it('asks for confirmation and replaces a document keeping the previous one', async () => {
      pickReplacement(localFile('cedula-nueva.png', 'image/png'));
      expect(element.querySelector('.registered__replace')?.textContent).toContain(
        'cedula-nueva.png',
      );
      httpTesting.expectNone(`${DOCUMENTS_URL}/${workerDocument().id}/replace`);

      button('Confirmar reemplazo').click();
      fixture.detectChanges();
      const req = await pending(`${DOCUMENTS_URL}/${workerDocument().id}/replace`);
      expect([...(req.request.body as FormData).keys()]).toEqual(['file']);
      req.flush(workerDocument({ id: 'nuevo', originalName: 'cedula-nueva.png' }), {
        status: 201,
        statusText: 'Created',
      });
      await loadDocuments([
        workerDocument({ id: 'nuevo', originalName: 'cedula-nueva.png' }),
        workerDocument({ replacedById: 'nuevo', replacedAt: '2026-11-16T10:00:00.000Z' }),
      ]);

      expect(element.textContent).toContain('La versión anterior queda en el historial.');
    });

    it('rejects an invalid replacement file without calling the API', () => {
      pickReplacement(localFile('foto.gif', 'image/gif'));

      expect(element.querySelector('.registered__item [role="alert"]')?.textContent).toContain(
        'foto.gif: Formato no permitido',
      );
      expect(element.querySelector('.registered__replace')).toBeNull();
    });

    it('shows backend conflicts when replacing', async () => {
      pickReplacement(localFile('cedula-nueva.pdf', 'application/pdf'));
      button('Confirmar reemplazo').click();
      fixture.detectChanges();

      (await pending(`${DOCUMENTS_URL}/${workerDocument().id}/replace`)).flush(
        {
          statusCode: 409,
          message: 'Ese documento ya fue reemplazado; reemplace la versión vigente',
          error: 'Conflict',
        },
        { status: 409, statusText: 'Conflict' },
      );
      await settle();

      expect(element.querySelector('.registered__item [role="alert"]')?.textContent).toContain(
        'Ese documento ya fue reemplazado',
      );
    });
  });

  describe('profile not editable', () => {
    it('hides upload and replacement, but keeps the download', async () => {
      render(false);
      await loadDocuments([workerDocument()]);

      expect(element.querySelector('app-file-dropzone')).toBeNull();
      expect(element.textContent).toContain(
        'Con el perfil en estado Pendiente de revisión no se pueden subir ni reemplazar',
      );
      expect(element.textContent).not.toContain('Reemplazar');
      expect(button('Descargar')).toBeTruthy();
    });
  });
});

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { OrderImage, OwnerOrder } from '../../models/order.model';
import { ownerOrder, photo, stubObjectUrls } from '../../testing/order.fixtures';
import { OrderPhotoManagerComponent } from './order-photo-manager.component';

const ORDER_ID = ownerOrder().id;
const IMAGES_URL = apiUrl('orders', 'me', ORDER_ID, 'images');

function image(position: number): OrderImage {
  return {
    id: `00000000-0000-4000-8000-00000000000${position}`,
    position,
    width: 1600,
    height: 1200,
    sizeBytes: 90000,
    thumbnailSizeBytes: 12000,
  };
}

function withImages(count: number): OwnerOrder {
  return ownerOrder({ images: Array.from({ length: count }, (_, index) => image(index + 1)) });
}

describe('OrderPhotoManagerComponent', () => {
  let fixture: ComponentFixture<OrderPhotoManagerComponent>;
  let element: HTMLElement;
  let httpTesting: HttpTestingController;
  let changed: OwnerOrder[];
  let stale: number;

  beforeEach(() => {
    stubObjectUrls();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.match((request) => request.method === 'GET');
    httpTesting.verify();
  });

  function render(order: OwnerOrder): void {
    fixture = TestBed.createComponent(OrderPhotoManagerComponent);
    fixture.componentRef.setInput('order', order);
    element = fixture.nativeElement as HTMLElement;
    changed = [];
    stale = 0;
    fixture.componentInstance.changed.subscribe((value) => {
      changed.push(value);
      fixture.componentRef.setInput('order', value);
    });
    fixture.componentInstance.stale.subscribe(() => stale++);
    fixture.detectChanges();
  }

  const text = () => element.textContent?.replace(/\s+/g, ' ') ?? '';
  const all = <T extends Element = HTMLButtonElement>(selector: string) =>
    Array.from(element.querySelectorAll<T & Element>(selector)) as T[];

  function click(selector: string, index = 0): void {
    all(selector)[index].click();
    fixture.detectChanges();
  }

  function pick(selector: string, files: File[]): void {
    const input = element.querySelector<HTMLInputElement>(selector);
    if (!input) {
      throw new Error(selector);
    }
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: Object.assign(files, { item: (index: number) => files[index] ?? null }),
    });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  const ADD_INPUT = 'app-order-photos-picker input[type="file"]';
  const REPLACE_INPUT = '.manager__replace-input';

  function flushUpload(order: OwnerOrder): FormData {
    const request = httpTesting.expectOne(
      (candidate) => candidate.url === IMAGES_URL && candidate.method === 'POST',
    );
    request.flush(order);
    fixture.detectChanges();
    return request.request.body as FormData;
  }

  it('shows the count and does not allow removing the only photo', () => {
    render(withImages(1));

    expect(text()).toContain('1 de 4 fotografías');
    expect(all('.manager__delete')[0].disabled).toBe(true);
    expect(text()).toContain('debe conservar al menos una fotografía');
  });

  it('does not offer to add photos when there are already four', () => {
    render(withImages(4));

    expect(element.querySelector('app-order-photos-picker')).toBeNull();
    expect(text()).toContain('Alcanzó el máximo de 4 fotografías');
  });

  it('rejects invalid formats and files over the remaining places', () => {
    render(withImages(3));

    pick(ADD_INPUT, [
      photo('foto.heic', 'image/heic'),
      photo('a.jpg'),
      photo('b.png', 'image/png'),
    ]);

    expect(text()).toContain('foto.heic: Formato no permitido');
    expect(text()).toContain('b.png: Se alcanzó el máximo de 1 fotografías.');
    expect(all('.photos__item')).toHaveLength(1);
    httpTesting.expectNone(IMAGES_URL);
  });

  it('previews the selection and uploads one file per request', () => {
    render(withImages(1));
    pick(ADD_INPUT, [photo('a.jpg'), photo('b.png', 'image/png')]);
    expect(element.querySelectorAll('.photos__image')).toHaveLength(2);
    httpTesting.expectNone(IMAGES_URL);

    click('.manager__upload');
    expect(all('.manager__upload')[0].disabled).toBe(true);
    expect((flushUpload(withImages(2)).get('image') as File).name).toBe('a.jpg');
    expect((flushUpload(withImages(3)).get('image') as File).name).toBe('b.png');

    expect(changed).toHaveLength(2);
    expect(text()).toContain('Se agregaron 2 fotografías.');
    expect(element.querySelector('.photos__item')).toBeNull();
  });

  it.each([
    [413, 'Cada fotografía puede pesar como máximo 10 MB', 0],
    [400, 'El archivo no es una imagen válida o está dañado', 0],
    [409, 'El pedido ya tiene el máximo de 4 fotografías. Elimine o reemplace una.', 1],
  ])('keeps the file and explains an upload error (%i)', (status, message, expectedStale) => {
    render(withImages(1));
    pick(ADD_INPUT, [photo('a.jpg')]);
    click('.manager__upload');

    httpTesting
      .expectOne(IMAGES_URL)
      .flush({ statusCode: status, message }, { status, statusText: 'Error' });
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(all('.photos__item')).toHaveLength(1);
    expect(stale).toBe(expectedStale);
  });

  it('removes a photo only after confirmation', () => {
    render(withImages(2));
    click('.manager__delete', 1);
    click('.dialog__cancel');
    httpTesting.expectNone((request) => request.method === 'DELETE');

    click('.manager__delete', 1);
    click('.dialog__confirm');

    const request = httpTesting.expectOne(`${IMAGES_URL}/${image(2).id}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(withImages(1));
    fixture.detectChanges();

    expect(text()).toContain('La fotografía se quitó del pedido.');
    expect(all('.manager__item')).toHaveLength(1);
  });

  it('replaces a photo after previewing it', () => {
    render(withImages(1));
    click('.manager__replace');
    pick(REPLACE_INPUT, [photo('nueva.webp', 'image/webp')]);
    expect(element.querySelector('.manager__preview')).not.toBeNull();
    httpTesting.expectNone((request) => request.method === 'PUT');

    click('.manager__replacement .manager__primary');

    const request = httpTesting.expectOne(`${IMAGES_URL}/${image(1).id}`);
    expect(request.request.method).toBe('PUT');
    request.flush(withImages(1));
    fixture.detectChanges();

    expect(text()).toContain('La fotografía se reemplazó.');
    expect(element.querySelector('.manager__replacement')).toBeNull();
  });

  it('does not accept an invalid replacement', () => {
    render(withImages(1));
    click('.manager__replace');

    pick(REPLACE_INPUT, [photo('doc.pdf', 'application/pdf')]);

    expect(text()).toContain('Formato no permitido');
    expect(element.querySelector('.manager__replacement')).toBeNull();
  });
});

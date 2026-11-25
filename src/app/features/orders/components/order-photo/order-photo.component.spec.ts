import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionStore } from '../../../../core/auth/session.store';
import { apiUrl } from '../../../../core/http/api-url';
import { apiErrorInterceptor } from '../../../../core/interceptors/api-error.interceptor';
import { authInterceptor } from '../../../../core/interceptors/auth.interceptor';
import { CLIENT, stubObjectUrls } from '../../testing/order.fixtures';
import { OrderPhotoComponent } from './order-photo.component';

const ORDER_ID = 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b';
const IMAGE_1 = 'f6a7b8c9-d0e1-4f2a-8b3c-4d5e6f7a8b9c';
const IMAGE_2 = 'a7b8c9d0-e1f2-4a3b-8c4d-5e6f7a8b9c0d';

function imageUrl(imageId: string): string {
  return apiUrl('orders', 'me', ORDER_ID, 'images', imageId);
}

describe('OrderPhotoComponent', () => {
  let fixture: ComponentFixture<OrderPhotoComponent>;
  let element: HTMLElement;
  let httpTesting: HttpTestingController;
  let urls: { created: string[]; revoked: string[] };

  function render(imageId = IMAGE_1, variant: 'thumb' | 'full' = 'thumb'): void {
    sessionStorage.clear();
    urls = stubObjectUrls();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    TestBed.inject(SessionStore).setSession({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      user: CLIENT,
    });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OrderPhotoComponent);
    fixture.componentRef.setInput('orderId', ORDER_ID);
    fixture.componentRef.setInput('imageId', imageId);
    fixture.componentRef.setInput('variant', variant);
    fixture.componentRef.setInput('alt', 'Fotografía del pedido');
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  async function respond(imageId: string): Promise<void> {
    const req = await vi.waitFor(() =>
      httpTesting.expectOne((request) => request.url === imageUrl(imageId)),
    );
    req.flush(new Blob(['webp'], { type: 'image/webp' }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
  });

  it('downloads the private image with the token and shows it from a blob URL', async () => {
    render(IMAGE_1, 'full');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Cargando fotografía');

    const req = await vi.waitFor(() =>
      httpTesting.expectOne((request) => request.url === imageUrl(IMAGE_1)),
    );
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    expect(req.request.params.get('variant')).toBe('full');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['webp'], { type: 'image/webp' }));
    await fixture.whenStable();
    fixture.detectChanges();

    const image = element.querySelector<HTMLImageElement>('img');
    expect(image?.getAttribute('src')).toBe('blob:preview-1');
    expect(image?.alt).toBe('Fotografía del pedido');
  });

  it('releases the previous blob URL when the image changes and on destroy', async () => {
    render();
    await respond(IMAGE_1);

    fixture.componentRef.setInput('imageId', IMAGE_2);
    fixture.detectChanges();
    await respond(IMAGE_2);

    expect(urls.revoked).toEqual(['blob:preview-1']);
    expect(element.querySelector('img')?.getAttribute('src')).toBe('blob:preview-2');

    fixture.destroy();
    expect(urls.revoked).toEqual(['blob:preview-1', 'blob:preview-2']);
  });

  it('shows a placeholder when the image cannot be loaded', async () => {
    render();
    const req = await vi.waitFor(() =>
      httpTesting.expectOne((request) => request.url === imageUrl(IMAGE_1)),
    );
    req.flush(
      new Blob([JSON.stringify({ statusCode: 404, message: 'La fotografía no existe' })], {
        type: 'application/json',
      }),
      { status: 404, statusText: 'Not Found' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent).toContain('Imagen no disponible');
    expect(urls.created).toEqual([]);
  });
});

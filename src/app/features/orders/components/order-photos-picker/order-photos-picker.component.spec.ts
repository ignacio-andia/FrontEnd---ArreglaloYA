import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { FileDropzoneComponent } from '../../../../shared/components/file-dropzone/file-dropzone.component';
import { PhotoPreviewService } from '../../services/photo-preview.service';
import { photo, stubObjectUrls } from '../../testing/order.fixtures';
import { ORDER_IMAGE_MAX_BYTES } from '../../validators/order.validators';
import { OrderPhotosPickerComponent } from './order-photos-picker.component';

@Component({
  imports: [ReactiveFormsModule, OrderPhotosPickerComponent],
  providers: [PhotoPreviewService],
  template: `<app-order-photos-picker [formControl]="images" />`,
})
class HostComponent {
  readonly images = new FormControl<File[]>([], { nonNullable: true });
}

describe('OrderPhotosPickerComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;
  let urls: { created: string[]; revoked: string[] };

  function render(initial: File[] = []): void {
    urls = stubObjectUrls();
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.images.setValue(initial);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  function choose(...files: File[]): void {
    const dropzone = fixture.debugElement.query(By.directive(FileDropzoneComponent))
      .componentInstance as FileDropzoneComponent;
    dropzone.filesSelected.emit(files);
    fixture.detectChanges();
  }

  function value(): File[] {
    return fixture.componentInstance.images.value;
  }

  function removeButtons(): HTMLButtonElement[] {
    return Array.from(element.querySelectorAll<HTMLButtonElement>('.photos__remove'));
  }

  it('adds the chosen photos with a preview and updates the form control', () => {
    render();
    choose(photo('fuga.jpg'), photo('detalle.webp', 'image/webp'));

    expect(value().map((file) => file.name)).toEqual(['fuga.jpg', 'detalle.webp']);
    expect(fixture.componentInstance.images.touched).toBe(true);
    const images = Array.from(element.querySelectorAll<HTMLImageElement>('.photos__image'));
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      'blob:preview-1',
      'blob:preview-2',
    ]);
    expect(images[0].alt).toBe('Vista previa de fuga.jpg');
    expect(element.querySelector('.photos__count')?.textContent).toContain('2 de 4 fotografías');
  });

  it('rejects invalid formats, oversized and repeated photos with a reason', () => {
    const existing = photo('fuga.jpg');
    render([existing]);
    choose(
      photo('foto.heic', 'image/heic'),
      photo('grande.png', 'image/png', ORDER_IMAGE_MAX_BYTES + 1),
      existing,
    );

    expect(value()).toEqual([existing]);
    const alert = element.querySelector('[role="alert"]')?.textContent ?? '';
    expect(alert).toContain('foto.heic: Formato no permitido');
    expect(alert).toContain('grande.png: La fotografía supera el tamaño máximo');
    expect(alert).toContain('fuga.jpg: Esta fotografía ya está agregada.');
  });

  it('accepts at most 4 photos and disables the selection when full', () => {
    render();
    choose(...['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg'].map((name) => photo(name)));

    expect(value().map((file) => file.name)).toEqual(['1.jpg', '2.jpg', '3.jpg', '4.jpg']);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      '5.jpg: Se alcanzó el máximo de 4 fotografías.',
    );
    expect(element.querySelector<HTMLButtonElement>('.dropzone__button')?.disabled).toBe(true);
    expect(element.querySelector('.photos__count')?.textContent).toContain('Alcanzó el máximo');
  });

  it('removes a photo, releases its preview and moves the focus', async () => {
    render();
    choose(photo('1.jpg'), photo('2.jpg'));

    removeButtons()[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(value().map((file) => file.name)).toEqual(['2.jpg']);
    expect(urls.revoked).toEqual(['blob:preview-1']);
    expect(document.activeElement).toBe(removeButtons()[0]);
  });

  it('shows the value written by the form and clears it on reset', () => {
    render([photo('inicial.jpg')]);
    expect(element.querySelector('.photos__name')?.textContent).toBe('inicial.jpg');

    fixture.componentInstance.images.reset([]);
    fixture.detectChanges();

    expect(element.querySelector('.photos__item')).toBeNull();
    expect(urls.revoked).toEqual(['blob:preview-1']);
  });

  it('disables the selection and the remove buttons when the control is disabled', () => {
    render([photo('inicial.jpg')]);
    fixture.componentInstance.images.disable();
    fixture.detectChanges();

    expect(element.querySelector<HTMLButtonElement>('.dropzone__button')?.disabled).toBe(true);
    expect(removeButtons()[0].disabled).toBe(true);
  });
});

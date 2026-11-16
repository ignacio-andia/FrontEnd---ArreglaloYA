import { TestBed } from '@angular/core/testing';
import { CatalogOption } from '../../models/catalog.model';
import { CategoryCardComponent } from './category-card.component';

describe('CategoryCardComponent', () => {
  function render(category: CatalogOption): HTMLElement {
    const fixture = TestBed.createComponent(CategoryCardComponent);
    fixture.componentRef.setInput('category', category);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the name and the description', () => {
    const element = render({
      id: '2b7e9d1c-3f4a-4b5c-8d6e-7f8091a2b3c4',
      name: 'Electricidad',
      description: 'Instalaciones y reparaciones',
    });

    expect(element.querySelector('h2')?.textContent).toBe('Electricidad');
    expect(element.querySelector('p')?.textContent).toBe('Instalaciones y reparaciones');
  });

  it('omits the description when it is null', () => {
    const element = render({
      id: '2b7e9d1c-3f4a-4b5c-8d6e-7f8091a2b3c4',
      name: 'Plomería',
      description: null,
    });

    expect(element.querySelector('h2')?.textContent).toBe('Plomería');
    expect(element.querySelector('p')).toBeNull();
  });
});

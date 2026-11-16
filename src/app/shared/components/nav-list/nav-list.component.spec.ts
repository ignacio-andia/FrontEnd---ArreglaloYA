import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavItem } from './nav-item.model';
import { NavListComponent } from './nav-list.component';

describe('NavListComponent', () => {
  const items: readonly NavItem[] = [
    { label: 'Resumen', path: '/cliente', exact: true },
    { label: 'Mis pedidos', path: null },
  ];

  function render() {
    // Ruta comodín para que la navegación del clic se resuelva dentro de la prueba.
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
    const fixture = TestBed.createComponent(NavListComponent);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    return fixture;
  }

  it('renders items with a path as links', () => {
    const element = render().nativeElement as HTMLElement;

    const links = element.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].textContent?.trim()).toBe('Resumen');
    expect(links[0].getAttribute('href')).toBe('/cliente');
  });

  it('renders items without a path as non-navigable "Próximamente"', () => {
    const element = render().nativeElement as HTMLElement;

    const pending = element.querySelector('.nav-link--pending');
    expect(pending?.tagName).toBe('SPAN');
    expect(pending?.textContent).toContain('Mis pedidos');
    expect(pending?.textContent).toContain('Próximamente');
  });

  it('emits itemSelected when a link is chosen', async () => {
    const fixture = render();
    let selected = 0;
    fixture.componentInstance.itemSelected.subscribe(() => selected++);

    (fixture.nativeElement as HTMLElement).querySelector('a')?.click();
    await fixture.whenStable();

    expect(selected).toBe(1);
  });
});

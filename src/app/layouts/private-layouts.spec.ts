import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { ClientLayoutComponent } from './client-layout/client-layout.component';
import { WorkerLayoutComponent } from './worker-layout/worker-layout.component';

interface LayoutCase {
  name: string;
  component: Type<unknown>;
  area: string;
  root: string;
  pending: string[];
}

const cases: LayoutCase[] = [
  {
    name: 'ClientLayoutComponent',
    component: ClientLayoutComponent,
    area: 'Área de cliente',
    root: '/cliente',
    pending: ['Mis pedidos', 'Publicar pedido', 'Mi cuenta'],
  },
  {
    name: 'WorkerLayoutComponent',
    component: WorkerLayoutComponent,
    area: 'Área de trabajador',
    root: '/trabajador',
    pending: ['Solicitudes disponibles', 'Mi perfil', 'Mi cuenta'],
  },
  {
    name: 'AdminLayoutComponent',
    component: AdminLayoutComponent,
    area: 'Administración',
    root: '/admin',
    pending: ['Categorías', 'Zonas', 'Usuarios', 'Bitácora'],
  },
];

describe.each(cases)('$name', ({ component, area, root, pending }) => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders its router outlet inside the main content area', () => {
    expect(render().querySelector('main router-outlet')).not.toBeNull();
  });

  it('identifies the area in the header', () => {
    expect(render().querySelector('.shell__area')?.textContent).toBe(area);
  });

  it('links only Resumen and shows the other sections as pending', () => {
    const nav = render().querySelector('nav.shell__sidebar');

    const links = Array.from(nav?.querySelectorAll('a') ?? []);
    expect(links.map((link) => [link.textContent?.trim(), link.getAttribute('href')])).toEqual([
      ['Resumen', root],
    ]);

    const pendingLabels = Array.from(nav?.querySelectorAll('.nav-link--pending') ?? []).map(
      (item) => item.firstChild?.textContent?.trim(),
    );
    expect(pendingLabels).toEqual(pending);
  });
});

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { User } from '../core/auth/auth.models';
import { SessionStore } from '../core/auth/session.store';
import { RoleName } from '../core/models/role.model';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { ClientLayoutComponent } from './client-layout/client-layout.component';
import { WorkerLayoutComponent } from './worker-layout/worker-layout.component';

interface LayoutCase {
  name: string;
  component: Type<unknown>;
  area: string;
  links: [string, string][];
  pending: string[];
}

const cases: LayoutCase[] = [
  {
    name: 'ClientLayoutComponent',
    component: ClientLayoutComponent,
    area: 'Área de cliente',
    links: [
      ['Resumen', '/cliente'],
      ['Mis pedidos', '/cliente/mis-pedidos'],
      ['Publicar pedido', '/cliente/publicar-pedido'],
      ['Ofertas recibidas', '/cliente/ofertas'],
      ['Mi cuenta', '/cliente/mi-cuenta'],
      ['Quiero ofrecer mis servicios', '/cliente/ofrecer-servicios'],
    ],
    pending: [],
  },
  {
    name: 'WorkerLayoutComponent',
    component: WorkerLayoutComponent,
    area: 'Área de trabajador',
    links: [
      ['Resumen', '/trabajador'],
      ['Pedidos disponibles', '/trabajador/pedidos'],
      ['Mis ofertas', '/trabajador/ofertas'],
      ['Trabajos asignados', '/trabajador/trabajos'],
      ['Mi perfil', '/trabajador/perfil'],
      ['Mi cuenta', '/trabajador/mi-cuenta'],
    ],
    pending: [],
  },
  {
    name: 'AdminLayoutComponent',
    component: AdminLayoutComponent,
    area: 'Administración',
    links: [
      ['Resumen', '/admin'],
      ['Reclamos', '/admin/reclamos'],
      ['Verificación de trabajadores', '/admin/trabajadores'],
      ['Mi cuenta', '/admin/mi-cuenta'],
    ],
    pending: ['Pedidos', 'Categorías', 'Zonas', 'Usuarios', 'Bitácora'],
  },
];

describe.each(cases)('$name', ({ component, area, links, pending }) => {
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

  it('links the sections with a page and shows the others as pending', () => {
    const nav = render().querySelector('nav.shell__sidebar');

    const anchors = Array.from(nav?.querySelectorAll('a') ?? []);
    expect(
      anchors.map((anchor) => [anchor.textContent?.trim(), anchor.getAttribute('href')]),
    ).toEqual(links);

    const pendingLabels = Array.from(nav?.querySelectorAll('.nav-link--pending') ?? []).map(
      (item) => item.firstChild?.textContent?.trim(),
    );
    expect(pendingLabels).toEqual(pending);
  });
});

describe('ClientLayoutComponent navigation by role', () => {
  function setup(roles: RoleName[]): { session: SessionStore; nav: () => [string, string][] } {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const session = TestBed.inject(SessionStore);
    session.setSession({ accessToken: 'jwt-token', tokenType: 'Bearer', user: userWith(roles) });
    const fixture = TestBed.createComponent(ClientLayoutComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return {
      session,
      nav: () => {
        fixture.detectChanges();
        return Array.from(element.querySelectorAll('nav.shell__sidebar a')).map(
          (anchor): [string, string] => [
            anchor.textContent?.trim() ?? '',
            anchor.getAttribute('href') ?? '',
          ],
        );
      },
    };
  }

  afterEach(() => sessionStorage.clear());

  it('offers to create the worker profile to a CLIENTE account', () => {
    const { nav } = setup(['CLIENTE']);

    expect(nav()).toContainEqual(['Quiero ofrecer mis servicios', '/cliente/ofrecer-servicios']);
    expect(nav().map(([label]) => label)).not.toContain('Mi perfil de trabajador');
  });

  it('links the worker profile when the account also has the TRABAJADOR role', () => {
    const { nav } = setup(['CLIENTE', 'TRABAJADOR']);

    expect(nav()).toContainEqual(['Mi perfil de trabajador', '/trabajador/perfil']);
    expect(nav().map(([label]) => label)).not.toContain('Quiero ofrecer mis servicios');
  });

  it('updates the menu when /auth/me reports a new role', () => {
    const { session, nav } = setup(['CLIENTE']);

    session.setUser(userWith(['CLIENTE', 'TRABAJADOR']));

    expect(nav()).toContainEqual(['Mi perfil de trabajador', '/trabajador/perfil']);
  });
});

function userWith(roles: RoleName[]): User {
  return {
    id: '8f1c2a8e-5a2b-4c3d-9e4f-1a2b3c4d5e6f',
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    phone: null,
    status: 'ACTIVO',
    roles,
    createdAt: '2026-11-15T14:30:00.000Z',
    updatedAt: '2026-11-15T14:30:00.000Z',
  };
}

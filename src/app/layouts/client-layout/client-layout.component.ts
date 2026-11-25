import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionStore } from '../../core/auth/session.store';
import { NavItem } from '../../shared/components/nav-list/nav-item.model';
import { PanelShellComponent } from '../../shared/components/panel-shell/panel-shell.component';

/**
 * Layout del área de cliente (`/cliente`). Las secciones sin página aún se muestran como pendientes.
 * Los pedidos propios y las ofertas recibidas pertenecen a esta área, aunque la cuenta también
 * tenga el rol TRABAJADOR. Con ese rol (leído de la sesión, que actualiza `/auth/me`), el acceso
 * para crear el perfil de trabajador se reemplaza por el enlace a «Mi perfil de trabajador».
 */
@Component({
  selector: 'app-client-layout',
  imports: [RouterOutlet, PanelShellComponent],
  template: `
    <app-panel-shell areaLabel="Área de cliente" [navItems]="navItems()">
      <router-outlet />
    </app-panel-shell>
  `,
  styleUrl: './client-layout.component.scss',
})
export class ClientLayoutComponent {
  private readonly session = inject(SessionStore);

  private readonly hasWorkerRole = computed(
    () => this.session.user()?.roles.includes('TRABAJADOR') ?? false,
  );

  protected readonly navItems = computed((): readonly NavItem[] => [
    { label: 'Resumen', path: '/cliente', exact: true },
    { label: 'Mis pedidos', path: '/cliente/mis-pedidos' },
    { label: 'Publicar pedido', path: '/cliente/publicar-pedido' },
    { label: 'Ofertas recibidas', path: '/cliente/ofertas' },
    { label: 'Buscar trabajadores', path: '/cliente/buscar-trabajadores' },
    { label: 'Mi cuenta', path: '/cliente/mi-cuenta' },
    this.hasWorkerRole()
      ? { label: 'Mi perfil de trabajador', path: '/trabajador/perfil' }
      : { label: 'Quiero ofrecer mis servicios', path: '/cliente/ofrecer-servicios' },
  ]);
}

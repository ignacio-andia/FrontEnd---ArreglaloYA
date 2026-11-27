import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavItem } from '../../shared/components/nav-list/nav-item.model';
import { PanelShellComponent } from '../../shared/components/panel-shell/panel-shell.component';

/** Layout del área de administración (`/admin`). */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, PanelShellComponent],
  template: `
    <app-panel-shell areaLabel="Administración" [navItems]="navItems">
      <router-outlet />
    </app-panel-shell>
  `,
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  protected readonly navItems: readonly NavItem[] = [
    { label: 'Resumen', path: '/admin', exact: true },
    { label: 'Reclamos', path: '/admin/reclamos' },
    { label: 'Verificación de trabajadores', path: '/admin/trabajadores' },
    { label: 'Pedidos', path: '/admin/pedidos' },
    { label: 'Categorías', path: '/admin/categorias' },
    { label: 'Zonas', path: '/admin/zonas' },
    { label: 'Usuarios', path: null },
    { label: 'Recomendaciones', path: '/admin/recomendaciones' },
    { label: 'Bitácora', path: '/admin/bitacora' },
    { label: 'Reportes', path: '/admin/reportes' },
    { label: 'Mi cuenta', path: '/admin/mi-cuenta' },
  ];
}

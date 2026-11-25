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
    { label: 'Verificación de trabajadores', path: null },
    { label: 'Pedidos', path: null },
    { label: 'Categorías', path: null },
    { label: 'Zonas', path: null },
    { label: 'Usuarios', path: null },
    { label: 'Bitácora', path: null },
    { label: 'Mi cuenta', path: '/admin/mi-cuenta' },
  ];
}

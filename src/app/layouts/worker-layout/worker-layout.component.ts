import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavItem } from '../../shared/components/nav-list/nav-item.model';
import { PanelShellComponent } from '../../shared/components/panel-shell/panel-shell.component';

/**
 * Layout del área de trabajador (`/trabajador`). El área exige el rol TRABAJADOR, no un perfil
 * aprobado: las páginas que requieran aprobación (pedidos disponibles y creación de ofertas)
 * añadirán approvedWorkerGuard en su propia ruta. Las ofertas propias y los trabajos asignados
 * pertenecen a esta área.
 */
@Component({
  selector: 'app-worker-layout',
  imports: [RouterOutlet, PanelShellComponent],
  template: `
    <app-panel-shell areaLabel="Área de trabajador" [navItems]="navItems">
      <router-outlet />
    </app-panel-shell>
  `,
  styleUrl: './worker-layout.component.scss',
})
export class WorkerLayoutComponent {
  protected readonly navItems: readonly NavItem[] = [
    { label: 'Resumen', path: '/trabajador', exact: true },
    { label: 'Pedidos disponibles', path: '/trabajador/pedidos' },
    { label: 'Mis ofertas', path: '/trabajador/ofertas' },
    { label: 'Trabajos asignados', path: null },
    { label: 'Mi perfil', path: '/trabajador/perfil' },
    { label: 'Mi cuenta', path: '/trabajador/mi-cuenta' },
  ];
}

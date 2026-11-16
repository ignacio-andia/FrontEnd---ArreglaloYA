import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavItem } from '../../shared/components/nav-list/nav-item.model';
import { PanelShellComponent } from '../../shared/components/panel-shell/panel-shell.component';

/**
 * Layout del área de trabajador (`/trabajador`). El área exige el rol TRABAJADOR, no un perfil
 * aprobado: las páginas que requieran aprobación (por ejemplo, solicitudes disponibles) añadirán
 * approvedWorkerGuard en su propia ruta.
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
    { label: 'Solicitudes disponibles', path: null },
    { label: 'Mi perfil', path: '/trabajador/perfil' },
    { label: 'Mi cuenta', path: null },
  ];
}

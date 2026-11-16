import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavItem } from '../../shared/components/nav-list/nav-item.model';
import { PanelShellComponent } from '../../shared/components/panel-shell/panel-shell.component';

/** Layout del área de cliente (`/cliente`). Las secciones sin página aún se muestran como pendientes. */
@Component({
  selector: 'app-client-layout',
  imports: [RouterOutlet, PanelShellComponent],
  template: `
    <app-panel-shell areaLabel="Área de cliente" [navItems]="navItems">
      <router-outlet />
    </app-panel-shell>
  `,
  styleUrl: './client-layout.component.scss',
})
export class ClientLayoutComponent {
  protected readonly navItems: readonly NavItem[] = [
    { label: 'Resumen', path: '/cliente', exact: true },
    { label: 'Mis pedidos', path: null },
    { label: 'Publicar pedido', path: null },
    { label: 'Mi cuenta', path: '/cliente/mi-cuenta' },
    { label: 'Quiero ofrecer mis servicios', path: '/cliente/ofrecer-servicios' },
  ];
}

import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NavItem } from './nav-item.model';

/**
 * Lista de navegación. Los elementos con ruta son enlaces (con `aria-current="page"` al estar
 * activos); los elementos sin ruta se muestran como "Próximamente" y no son navegables.
 * Debe ubicarse dentro de un `<nav>` con nombre accesible.
 */
@Component({
  selector: 'app-nav-list',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <ul class="nav-list" [class.nav-list--horizontal]="orientation() === 'horizontal'">
      @for (item of items(); track item.label) {
        <li>
          @if (item.path !== null) {
            <a
              class="nav-link"
              [routerLink]="item.path"
              routerLinkActive="is-active"
              [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
              ariaCurrentWhenActive="page"
              (click)="itemSelected.emit()"
              >{{ item.label }}</a
            >
          } @else {
            <span class="nav-link nav-link--pending">
              {{ item.label }}
              <span class="badge">Próximamente</span>
            </span>
          }
        </li>
      }
    </ul>
  `,
  styleUrl: './nav-list.component.scss',
})
export class NavListComponent {
  readonly items = input.required<readonly NavItem[]>();
  readonly orientation = input<'horizontal' | 'vertical'>('vertical');

  /** Se emite al elegir un enlace (permite cerrar menús móviles). */
  readonly itemSelected = output();
}

import { Component, ElementRef, computed, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavItem } from '../nav-list/nav-item.model';
import { NavListComponent } from '../nav-list/nav-list.component';
import { UserMenuComponent } from '../user-menu/user-menu.component';

/**
 * Estructura común de los paneles privados: encabezado con identificación y menú de sesión,
 * navegación lateral (desplegable en móvil) y área de contenido, que recibe el `router-outlet`
 * del layout por proyección. Los colores del área se ajustan desde el layout con propiedades CSS
 * (`--panel-sidebar-bg`, `--nav-link-*`, `--focus-ring-color`).
 */
@Component({
  selector: 'app-panel-shell',
  imports: [RouterLink, NavListComponent, UserMenuComponent],
  templateUrl: './panel-shell.component.html',
  styleUrl: './panel-shell.component.scss',
  host: {
    '(document:keydown.escape)': 'closeNav()',
  },
})
export class PanelShellComponent {
  /** Nombre del área, visible en el encabezado (por ejemplo, "Área de cliente"). */
  readonly areaLabel = input.required<string>();
  readonly navItems = input.required<readonly NavItem[]>();

  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  protected readonly navId = 'panel-navigation';
  protected readonly navOpen = signal(false);
  protected readonly navLabel = computed(() => `Menú: ${this.areaLabel()}`);

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }

  /** Lleva el foco al contenido sin cambiar la URL (el `href="#..."` no funciona con `<base href>`). */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }
}

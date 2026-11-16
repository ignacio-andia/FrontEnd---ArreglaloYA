import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { SessionStore } from '../../core/auth/session.store';
import { NavItem } from '../../shared/components/nav-list/nav-item.model';
import { NavListComponent } from '../../shared/components/nav-list/nav-list.component';
import { UserMenuComponent } from '../../shared/components/user-menu/user-menu.component';

/**
 * Layout público (visitantes y usuarios autenticados en el sitio comercial).
 * Con sesión, el acceso a la cuenta se reemplaza por el menú de sesión.
 */
@Component({
  selector: 'app-public-layout',
  imports: [RouterLink, RouterOutlet, NavListComponent, UserMenuComponent],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss',
  host: {
    '(document:keydown.escape)': 'closeMenu()',
  },
})
export class PublicLayoutComponent {
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  protected readonly isAuthenticated = inject(SessionStore).isAuthenticated;
  protected readonly menuId = 'public-menu';
  protected readonly menuOpen = signal(false);

  protected readonly mainNav: readonly NavItem[] = [
    { label: 'Inicio', path: '/', exact: true },
    { label: 'Categorías', path: '/categorias' },
    { label: 'Cómo funciona', path: null },
  ];

  protected readonly accountNav: readonly NavItem[] = [
    { label: 'Iniciar sesión', path: '/auth/login' },
    { label: 'Registrarse', path: '/auth/registro' },
  ];

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  /** Lleva el foco al contenido sin cambiar la URL (el `href="#..."` no funciona con `<base href>`). */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }
}

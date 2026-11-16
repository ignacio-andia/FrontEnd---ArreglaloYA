import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AREA_HOME_PATHS } from '../../../core/auth/auth-navigation';
import { AuthService } from '../../../core/auth/auth.service';
import { SessionStore } from '../../../core/auth/session.store';
import { RoleName } from '../../../core/models/role.model';

interface AreaLink {
  role: RoleName;
  label: string;
  path: string;
}

/** Áreas privadas por rol. Una cuenta con varios roles ve todas las que le corresponden. */
const AREA_LINKS: readonly AreaLink[] = [
  { role: 'CLIENTE', label: 'Área de cliente', path: AREA_HOME_PATHS.CLIENTE },
  { role: 'TRABAJADOR', label: 'Área de trabajador', path: AREA_HOME_PATHS.TRABAJADOR },
  { role: 'ADMINISTRADOR', label: 'Administración', path: AREA_HOME_PATHS.ADMINISTRADOR },
];

/**
 * Identificación del usuario autenticado y menú de sesión (patrón disclosure):
 * datos de la cuenta, acceso a las áreas según sus roles y cierre de sesión local.
 * No se muestra si no hay usuario cargado.
 */
@Component({
  selector: 'app-user-menu',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class UserMenuComponent {
  private readonly session = inject(SessionStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly panelId = 'user-menu-panel';
  protected readonly user = this.session.user;
  protected readonly open = signal(false);

  protected readonly fullName = computed(() => {
    const user = this.user();
    return user ? `${user.firstName} ${user.lastName}` : '';
  });

  protected readonly initials = computed(() => {
    const user = this.user();
    return user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : '';
  });

  protected readonly areas = computed(() => {
    const roles = this.user()?.roles ?? [];
    return AREA_LINKS.filter((area) => roles.includes(area.role));
  });

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected logout(): void {
    this.close();
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }

  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (this.open() && target instanceof Node && !this.host.nativeElement.contains(target)) {
      this.close();
    }
  }

  protected onEscape(): void {
    if (this.open()) {
      this.close();
      this.trigger()?.nativeElement.focus();
    }
  }
}

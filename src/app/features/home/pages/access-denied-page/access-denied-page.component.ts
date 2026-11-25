import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { homePathForRoles } from '../../../../core/auth/auth-navigation';
import { SessionStore } from '../../../../core/auth/session.store';

/** Destino de roleGuard cuando la cuenta no tiene el rol del área solicitada. */
@Component({
  selector: 'app-access-denied-page',
  imports: [RouterLink],
  template: `
    <section class="home home--public" aria-labelledby="denied-title">
      <header>
        <h1 id="denied-title" class="home__title">Acceso no permitido</h1>
        <p class="home__intro">Su cuenta no tiene permiso para ver esa sección.</p>
      </header>
      <div class="home__actions">
        <a class="denied__primary" [routerLink]="areaPath()">{{
          areaPath() === '/' ? 'Ir al inicio' : 'Ir a mi área'
        }}</a>
      </div>
    </section>
  `,
  styleUrls: ['../../home-page.scss', './access-denied-page.component.scss'],
})
export class AccessDeniedPageComponent {
  private readonly session = inject(SessionStore);

  protected readonly areaPath = computed(() => homePathForRoles(this.session.user()?.roles ?? []));
}

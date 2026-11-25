import { Component, computed, inject } from '@angular/core';
import { SessionStore } from '../../../../core/auth/session.store';
import { ActionCardComponent } from '../../../../shared/components/action-card/action-card.component';

/** Inicio de administración. Las herramientas de gestión todavía no tienen pantalla. */
@Component({
  selector: 'app-admin-home-page',
  imports: [ActionCardComponent],
  template: `
    <section class="home" aria-labelledby="admin-home-title">
      <header>
        <h1 id="admin-home-title" class="home__title">Hola, {{ firstName() }}</h1>
        <p class="home__intro">
          Las secciones de gestión marcadas como «Próximamente» en el menú todavía no están
          disponibles.
        </p>
      </header>

      <section class="home__section" aria-labelledby="admin-home-actions-title">
        <h2 id="admin-home-actions-title" class="home__subtitle">Accesos disponibles</h2>
        <ul class="home__grid">
          <li>
            <app-action-card
              heading="Reclamos"
              description="Revise los reclamos de los clientes y registre su decisión."
              path="/admin/reclamos"
            />
          </li>
          <li>
            <app-action-card
              heading="Mi cuenta"
              description="Actualice su nombre y teléfono."
              path="/admin/mi-cuenta"
            />
          </li>
          <li>
            <app-action-card
              heading="Categorías publicadas"
              description="Vea las categorías activas tal como las ve el público."
              path="/categorias"
            />
          </li>
        </ul>
      </section>
    </section>
  `,
  styleUrl: '../../home-page.scss',
})
export class AdminHomePageComponent {
  private readonly session = inject(SessionStore);

  protected readonly firstName = computed(() => this.session.user()?.firstName ?? '');
}

import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../../../core/auth/session.store';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { CategoryCardComponent } from '../../../catalogs/components/category-card/category-card.component';
import { CatalogsApiService } from '../../../catalogs/services/catalogs-api.service';
import { HowItWorksComponent } from '../../components/how-it-works/how-it-works.component';

/** Categorías que se muestran en el inicio; el resto está en `/categorias`. */
export const HOME_CATEGORIES_LIMIT = 6;

const CATEGORIES_ERROR = 'No se pudieron cargar las categorías.';

/** Inicio público: presentación, categorías activas y cómo funciona la contratación. */
@Component({
  selector: 'app-public-home-page',
  imports: [
    RouterLink,
    CategoryCardComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    HowItWorksComponent,
    LoadingStateComponent,
  ],
  templateUrl: './public-home-page.component.html',
  styleUrls: ['../../home-page.scss', './public-home-page.component.scss'],
})
export class PublicHomePageComponent {
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly session = inject(SessionStore);

  protected readonly categories = rxResource({ stream: () => this.catalogsApi.getCategories() });

  protected readonly featured = computed(() =>
    this.categories.hasValue() ? this.categories.value().slice(0, HOME_CATEGORIES_LIMIT) : [],
  );

  protected readonly categoriesError = computed(() => {
    const error = this.categories.error();
    return error === undefined ? null : apiErrorMessages(error, CATEGORIES_ERROR).join(' ');
  });

  /** Publicar exige el rol CLIENTE; sin sesión, el guard pide iniciarla. */
  protected readonly canRequestService = computed(() => {
    const user = this.session.user();
    return user === null || user.roles.includes('CLIENTE');
  });
}

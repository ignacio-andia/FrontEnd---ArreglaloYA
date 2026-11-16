import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { isNormalizedApiError } from '../../../../core/models/api-error.model';
import { CategoryCardComponent } from '../../components/category-card/category-card.component';
import { CatalogsApiService } from '../../services/catalogs-api.service';

const LOAD_ERROR_MESSAGE = 'No se pudieron cargar las categorías. Inténtelo de nuevo más tarde.';

/** Página pública con las categorías de servicio activas (`GET /catalogs/categories`). */
@Component({
  selector: 'app-categories-page',
  imports: [CategoryCardComponent],
  templateUrl: './categories-page.component.html',
  styleUrl: './categories-page.component.scss',
})
export class CategoriesPageComponent {
  private readonly catalogsApi = inject(CatalogsApiService);

  protected readonly categories = rxResource({
    stream: () => this.catalogsApi.getCategories(),
  });

  /**
   * Mensaje del error de carga. El resource envuelve los valores que no son `Error`
   * (como el `NormalizedApiError` del interceptor) y los deja en `cause`.
   */
  protected readonly errorMessage = computed(() => {
    const error = this.categories.error();
    if (error === undefined) {
      return null;
    }

    const cause: unknown = error.cause ?? error;
    return isNormalizedApiError(cause) ? cause.messages.join(' ') : LOAD_ERROR_MESSAGE;
  });

  protected retry(): void {
    this.categories.reload();
  }
}

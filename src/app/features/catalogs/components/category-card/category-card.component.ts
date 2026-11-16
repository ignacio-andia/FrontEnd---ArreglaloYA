import { Component, input } from '@angular/core';
import { CatalogOption } from '../../models/catalog.model';

/** Presenta una categoría de servicio: su nombre y, si existe, su descripción. */
@Component({
  selector: 'app-category-card',
  template: `
    <article class="category-card">
      <h2 class="category-card__name">{{ category().name }}</h2>
      @if (category().description; as description) {
        <p class="category-card__description">{{ description }}</p>
      }
    </article>
  `,
  styleUrl: './category-card.component.scss',
})
export class CategoryCardComponent {
  readonly category = input.required<CatalogOption>();
}

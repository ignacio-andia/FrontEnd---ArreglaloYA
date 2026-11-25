import { Component, input, output } from '@angular/core';

/** Navegación entre las páginas de un listado paginado por el backend. */
@Component({
  selector: 'app-paginator',
  template: `
    <nav class="pager" [attr.aria-label]="label()">
      <button
        type="button"
        class="pager__button"
        [disabled]="page() <= 1 || busy()"
        (click)="pageChange.emit(page() - 1)"
      >
        Anterior
      </button>
      <p class="pager__info">
        Página {{ page() }} de {{ totalPages() }} · {{ total() }} resultados
      </p>
      <button
        type="button"
        class="pager__button"
        [disabled]="page() >= totalPages() || busy()"
        (click)="pageChange.emit(page() + 1)"
      >
        Siguiente
      </button>
    </nav>
  `,
  styles: `
    @use 'tokens';
    @use 'buttons';

    :host {
      display: block;
    }

    .pager {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: tokens.$space-3;
    }

    .pager__info {
      color: var(--color-text-secondary);
      font-size: 0.9375rem;
    }

    .pager__button {
      @include buttons.secondary;
    }
  `,
})
export class PaginatorComponent {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly total = input.required<number>();
  /** Nombre accesible de la navegación, por ejemplo «Páginas de pedidos». */
  readonly label = input.required<string>();
  /** Deshabilita los botones mientras se carga otra página. */
  readonly busy = input(false);

  readonly pageChange = output<number>();
}

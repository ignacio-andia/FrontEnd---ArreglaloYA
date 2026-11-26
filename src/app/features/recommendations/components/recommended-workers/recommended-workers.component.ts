import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { apiErrorMessages } from '../../../../shared/utils/api-error-message';
import { DISPLAY_TIMEZONE } from '../../../../shared/utils/display-timezone';
import { OrderStatus } from '../../../orders/models/order.model';
import {
  RECOMMENDABLE_ORDER_STATUSES,
  WorkerRecommendation,
} from '../../models/recommendation.model';
import { RecommendationsApiService } from '../../services/recommendations-api.service';

const LIST_ERROR = 'No se pudieron consultar las recomendaciones de este pedido.';
const GENERATE_ERROR = 'No se pudo generar la recomendación. Inténtelo de nuevo.';

/**
 * En el detalle de un pedido propio: trabajadores recomendados por reputación, servicios
 * completados y disponibilidad, con el puntaje de cada criterio y los pesos usados. Mientras el
 * pedido está publicado o en negociación el cliente genera una recomendación nueva; después solo
 * consulta las guardadas. El cálculo y las validaciones los hace el backend.
 */
@Component({
  selector: 'app-recommended-workers',
  imports: [DatePipe, RouterLink, LoadingStateComponent],
  templateUrl: './recommended-workers.component.html',
  styleUrl: './recommended-workers.component.scss',
})
export class RecommendedWorkersComponent {
  private readonly api = inject(RecommendationsApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly orderId = input.required<string>();
  readonly status = input.required<OrderStatus>();

  protected readonly timezone = DISPLAY_TIMEZONE;

  protected readonly canGenerate = computed(() =>
    RECOMMENDABLE_ORDER_STATUSES.includes(this.status()),
  );

  protected readonly history = rxResource({
    params: () => this.orderId() || undefined,
    stream: ({ params }) => this.api.list(params),
  });
  protected readonly items = computed<WorkerRecommendation[]>(() =>
    this.history.hasValue() ? this.history.value() : [],
  );
  protected readonly listError = computed(() => {
    const error = this.history.error();
    return error === undefined ? null : apiErrorMessages(error, LIST_ERROR).join(' ');
  });

  /** Sin recomendaciones guardadas y sin poder generar, la sección no se muestra. */
  protected readonly visible = computed(() => this.canGenerate() || this.items().length > 0);

  /** Recomendación que se muestra: la más reciente, salvo que el cliente elija otra. */
  protected readonly selectedId = linkedSignal<WorkerRecommendation[], string | null>({
    source: this.items,
    computation: (items) => items[0]?.id ?? null,
  });
  protected readonly selected = computed(
    () => this.items().find((item) => item.id === this.selectedId()) ?? null,
  );

  protected readonly generating = signal(false);
  protected readonly generateError = signal<string | null>(null);
  protected readonly generated = signal(false);

  protected generate(): void {
    if (this.generating()) {
      return;
    }
    this.generating.set(true);
    this.generateError.set(null);
    this.generated.set(false);
    this.api
      .generate(this.orderId())
      .pipe(
        finalize(() => this.generating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (created) => {
          this.history.set([created, ...this.items()]);
          this.generated.set(true);
        },
        error: (error: unknown) =>
          this.generateError.set(apiErrorMessages(error, GENERATE_ERROR).join(' ')),
      });
  }

  protected select(id: string): void {
    this.selectedId.set(id);
    this.generated.set(false);
  }
}

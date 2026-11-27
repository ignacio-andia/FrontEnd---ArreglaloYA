import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Subscription, finalize } from 'rxjs';
import { apiErrorMessages, apiErrorStatus } from '../../../shared/utils/api-error-message';
import { TimelineEvent, TimelinePage } from '../models/timeline.model';
import { TimelineApiService } from './timeline-api.service';
import { WorkflowApiService } from './workflow-api.service';

const WORKFLOW_ERROR = 'No se pudo cargar el estado del trabajo.';
const TIMELINE_ERROR = 'No se pudo cargar el historial.';
/** Respuestas que indican que lo mostrado puede estar desactualizado. */
const STALE_STATUSES: readonly number[] = [403, 404, 409];

/**
 * Estado del seguimiento de un pedido: flujo (#82) e historial por cursor (#112). Se provee en
 * cada página de seguimiento. No deriva estados ni acontecimientos: muestra lo que responde el
 * backend y vuelve a consultarlo si una respuesta indica que quedó desactualizado.
 */
@Injectable()
export class ServiceWorkStore {
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly timelineApi = inject(TimelineApiService);

  private readonly orderId = signal<string | undefined>(undefined);
  /** Pedido indicado con `load` o `loadHistory`. */
  readonly requestedOrderId = this.orderId.asReadonly();
  /** El flujo (#82) es de las partes: quien solo mira el historial no lo consulta. */
  private readonly withWorkflow = signal(true);

  readonly workflow = rxResource({
    params: () => (this.withWorkflow() ? this.orderId() : undefined),
    stream: ({ params }) => this.workflowApi.get(params),
  });
  private readonly firstPage = rxResource({
    params: () => this.orderId(),
    stream: ({ params }) => this.timelineApi.get(params),
  });

  /** Páginas pedidas con «Cargar más», a continuación de la primera. */
  private readonly following = signal<readonly TimelinePage[]>([]);
  private pending: Subscription | null = null;

  readonly loadingMore = signal(false);
  readonly moreError = signal<string | null>(null);

  readonly current = computed(() => (this.workflow.hasValue() ? this.workflow.value() : null));
  readonly notFound = computed(() => {
    const status = apiErrorStatus(this.workflow.error());
    return status === 404 || status === 400;
  });
  readonly errorMessage = computed(() => {
    const error = this.workflow.error();
    return error === undefined || this.notFound()
      ? null
      : apiErrorMessages(error, WORKFLOW_ERROR).join(' ');
  });

  private readonly pages = computed(() =>
    this.firstPage.hasValue() ? [this.firstPage.value(), ...this.following()] : [],
  );
  /** Acontecimientos cargados, sin repetidos, en el orden del backend. */
  readonly events = computed((): readonly TimelineEvent[] => {
    const unique = new Map<string, TimelineEvent>();
    for (const page of this.pages()) {
      for (const event of page.data) {
        unique.set(`${event.source}:${event.id}:${event.type}`, event);
      }
    }
    return [...unique.values()];
  });
  readonly nextCursor = computed(() => this.pages().at(-1)?.nextCursor ?? null);
  readonly timelineLoading = computed(
    () => this.firstPage.isLoading() && this.pages().length === 0,
  );
  /** El historial se está volviendo a pedir: lo cargado (y su cursor) todavía es el anterior. */
  readonly timelineReloading = computed(() => this.firstPage.isLoading());
  readonly timelineError = computed(() => {
    const error = this.firstPage.error();
    return error === undefined ? null : apiErrorMessages(error, TIMELINE_ERROR).join(' ');
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pending?.unsubscribe());
  }

  load(orderId: string): void {
    this.open(orderId, true);
  }

  /** Solo el historial (#112), para quien no puede consultar el flujo (administración). */
  loadHistory(orderId: string): void {
    this.open(orderId, false);
  }

  private open(orderId: string, withWorkflow: boolean): void {
    this.restartPages();
    this.withWorkflow.set(withWorkflow);
    this.orderId.set(orderId);
  }

  /** Vuelve a consultar el flujo y el historial desde el principio. */
  refresh(): void {
    this.restartPages();
    this.workflow.reload();
    this.firstPage.reload();
  }

  loadMore(): void {
    const orderId = this.orderId();
    const cursor = this.nextCursor();
    if (orderId === undefined || cursor === null || this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    this.moreError.set(null);
    this.pending = this.timelineApi
      .get(orderId, cursor)
      .pipe(finalize(() => this.loadingMore.set(false)))
      .subscribe({
        next: (page) => this.following.update((pages) => [...pages, page]),
        error: (error: unknown) => {
          if (STALE_STATUSES.includes(apiErrorStatus(error) ?? 0)) {
            this.refresh();
          } else {
            this.moreError.set(apiErrorMessages(error, TIMELINE_ERROR).join(' '));
          }
        },
      });
  }

  private restartPages(): void {
    this.pending?.unsubscribe();
    this.pending = null;
    this.following.set([]);
    this.moreError.set(null);
  }
}

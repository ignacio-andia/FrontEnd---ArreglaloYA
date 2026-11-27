# 11. Recomendación de trabajadores (#116–#119)

Contratos del sistema de recomendación de trabajadores por **reputación**, **servicios completados** y **disponibilidad**. Backend: módulo `src/modules/recommendations/` y migración `20261126000000_worker_recommendations`. Frontend: `src/app/features/recommendations/`.

## Endpoints

| #   | Método y ruta                               | Rol           | Respuesta                              | Errores                                                                                                 |
| --- | ------------------------------------------- | ------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 116 | `POST /api/orders/:orderId/recommendations` | CLIENTE       | `201` `RecommendationView`             | `400` id inválido · `401` · `404` pedido inexistente o ajeno · `409` estado no permitido                |
| 117 | `GET /api/orders/:orderId/recommendations`  | CLIENTE       | `200` `RecommendationView[]` (máx. 10) | `400` · `401` · `404`                                                                                   |
| 118 | `GET /api/admin/recommendation-settings`    | ADMINISTRADOR | `200` `RecommendationSettingsOverview` | `401` · `403`                                                                                           |
| 119 | `PUT /api/admin/recommendation-settings`    | ADMINISTRADOR | `200` `RecommendationSettingsOverview` | `400` validación o pesos que no suman 100 · `401` · `403` · `409` valores iguales o versión concurrente |

- **#116** no tiene cuerpo. Genera y **guarda** una recomendación con la versión vigente de los criterios. Solo para pedidos propios en `PUBLICADO` o `EN_NEGOCIACION` (estado efectivo: un pedido vencido responde 409 con el mensaje «Solo se recomiendan trabajadores mientras el pedido está publicado o en negociación.»).
- **#117** devuelve las recomendaciones guardadas del pedido, de la más reciente a la más antigua, en cualquier estado del pedido.
- **#119** crea una versión nueva; las anteriores no cambian. Registra en la bitácora (`entityType: CONFIGURACION_RECOMENDACION`, `action: EDICION`, `details: { version, previousVersion, before, after }`).

## DTO de entrada (#119) `UpdateRecommendationSettingsDto`

Todos obligatorios, enteros (`forbidNonWhitelisted`):

| Campo                     | Rango  | Significado                                                    |
| ------------------------- | ------ | -------------------------------------------------------------- |
| `reputationWeight`        | 0–100  | Peso de la reputación (%)                                      |
| `completedServicesWeight` | 0–100  | Peso de los servicios completados (%)                          |
| `availabilityWeight`      | 0–100  | Peso de la disponibilidad (%)                                  |
| `reviewsForConfidence`    | 0–50   | Calificaciones neutras de 3 estrellas que se suman al promedio |
| `completedServicesTarget` | 1–1000 | Servicios completados con los que el criterio llega a 100      |
| `availabilityHoursTarget` | 1–168  | Horas libres en 7 días con las que el criterio llega a 100     |

Los tres pesos deben sumar **exactamente 100** (400 «Los pesos de reputación, servicios completados y disponibilidad deben sumar 100.»; la BD lo respalda con `recommendation_settings_weights_check`).

## Modelos de respuesta

```ts
interface RecommendationSettingsView {
  id: string;
  version: number;
  reputationWeight: number;
  completedServicesWeight: number;
  availabilityWeight: number;
  reviewsForConfidence: number;
  completedServicesTarget: number;
  availabilityHoursTarget: number;
  neutralRating: 3;
  availabilityWindowDays: 7;
  createdAt: string; // ISO 8601 UTC
  createdBy: { id: string; firstName: string; lastName: string } | null; // null: versión 1
}

interface RecommendationSettingsOverview {
  current: RecommendationSettingsView;
  history: RecommendationSettingsView[]; // todas, de la más reciente a la más antigua
}

interface CriterionView {
  score: string; // 0–100, 2 decimales
  weight: number; // %
  points: string; // score × weight / 100
  explanation: string; // frase en español
}

interface RecommendedWorkerView {
  rank: number;
  workerId: string;
  firstName: string;
  lastName: string;
  totalScore: string;
  reputation: CriterionView & {
    reviewsCount: number;
    averageRating: string | null;
    adjustedRating: string;
  };
  completedServices: CriterionView & { count: number; target: number };
  availability: CriterionView & {
    weeklyScheduleHours: string;
    bookedHours: string;
    freeHours: string;
    targetHours: number;
  };
  openOfferId: string | null; // oferta VIGENTE del trabajador en el pedido al generar
}

interface RecommendationView {
  id: string;
  orderId: string;
  createdAt: string;
  candidatesCount: number; // candidatos evaluados; se guardan y devuelven los 10 mejores
  criteria: RecommendationSettingsView; // la versión usada
  workers: RecommendedWorkerView[];
  message: string | null; // sin candidatos
}
```

## Reglas del cálculo

- **Candidatos:** los mismos filtros que la búsqueda de trabajadores (RF-16): perfil `APROBADO`, de la zona y la categoría del pedido, cuenta `ACTIVO`, sin cambio de zona pendiente y distinto del cliente. Categoría o zona desactivada: sin candidatos.
- **Reputación:** promedio bayesiano de las calificaciones visibles de clientes: `(C × 3 + suma) / (C + n)`, con `C = reviewsForConfidence`. Puntaje = `(ajustado − 1) / 4 × 100`.
- **Servicios completados:** pedidos asignados en `TERMINADO` o `CERRADO` con fecha de fin del trabajo. Puntaje = `min(n / completedServicesTarget, 1) × 100`.
- **Disponibilidad:** minutos semanales del horario de atención activo menos los minutos de trabajos acordados (misma fuente que la agenda, RF-30) dentro de los próximos 7 días. Puntaje = `min(libres / (availabilityHoursTarget × 60), 1) × 100`.
- **Total:** `Σ puntaje × peso / 100`. Desempate: reputación, servicios, horas libres e id.
- **Persistencia:** `recommendation_settings` (versionada), `worker_recommendations` y `worker_recommendation_items`. Las tres son de solo inserción (trigger `recommendations_append_only`).

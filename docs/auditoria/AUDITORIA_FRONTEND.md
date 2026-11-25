# Auditoría integral del frontend — ArreglaloYA

Fecha: 25/11/2026 · Rama `main` en `fac0e3a` · Backend `2918395` (sin modificar).

> El encargo llegó cortado en «5. Porcentaje de avance → Calcula: Re…». Las fórmulas de la sección 2 son la interpretación usada.

## 1. Cómo se verificó

| Comprobación | Resultado en esta auditoría |
|---|---|
| Pruebas unitarias | 892 de 892 (76 archivos) |
| Build, ESLint, Prettier (`--end-of-line auto`) | Correctos; carga inicial 323,85 kB |
| Integración real contra la API (14 scripts, esquema aislado) | 171 de 171 comprobaciones numeradas y la prueba de paginación, todas con salida 0 |
| Recorrido de pantallas contra el backend real | unas 40 visitas a 375 px y 24 a 360 px, con cliente, trabajador, trabajador pendiente, administrador y visitante: sin errores, sin desbordamiento y sin infracciones de axe |
| Base `public` | Huella idéntica a la inicial, comparada al cerrar la auditoría |

**Límites.** Los scripts prueban el contrato de la API, no la interfaz. El recorrido solo lee: las escrituras desde la interfaz no se repitieron en esta auditoría (en etapas anteriores se probaron en el navegador las de E3.2 a E3.5). No se probó lector de pantalla, Firefox, Edge ni rendimiento. No se ejecutaron las pruebas propias del backend: su estado sale de su matriz.

**Criterio de «Completo y verificado».** El frontend cubre los criterios, el backend figura verificado, y hay integración real (API o pantalla) de sus endpoints y pruebas unitarias. **Estado global** mide lo que un usuario puede hacer de extremo a extremo: sin pantalla es «No implementado» aunque el backend exista.

**Vigencia de la matriz del backend.** Sus 40 archivos citados existen y siguen válidas las observaciones comprobadas (sin cierre de sesión en servidor ni recuperación, oferta de 24 h y 3 rondas fijas, calificaciones sin configurar). Ya **no aplica** la de RNF-09 «cambios sin confirmar en Git»: están confirmados y en `main`.

## 2. Porcentajes de avance

| Estado (RF) | Backend (matriz) | Frontend | Global |
|---|---|---|---|
| Completo | 34 | 29 (51,8 %) | 15 (26,8 %) |
| Parcial | 20 | 11 (19,6 %) | 19 (33,9 %) |
| Pendiente de validación | 0 | 0 (0,0 %) | 6 (10,7 %) |
| No implementado | 2 | 16 (28,6 %) | 12 (21,4 %) |
| Bloqueado | 0 | 0 (0,0 %) | 4 (7,1 %) |
| Fuera de alcance | 0 | 0 (0,0 %) | 0 (0,0 %) |

| Indicador | Fórmula | Valor |
|---|---|---|
| Requerimientos completos y verificados | completos / 56 | **15 de 56 = 26,8 %** |
| Sobre lo realizable hoy | completos / (56 − bloqueados) | 15 de 52 = 28,8 % |
| Avance ponderado | (completos + ½ parciales y por validar) / 56 | 27,5 de 56 = 49,1 % |
| Frontend completo | pantallas que cubren sus criterios / 56 | 29 de 56 = 51,8 % |
| Endpoints consumidos | usados por una pantalla / 115 | **68 de 115 = 59,1 %** |
| Endpoints probados por integración de API | con respuesta correcta en scripts / 115 | 53 de 115 = 46,1 % |
| Consumidos y probados por API | intersección / 115 | 51 de 115 = 44,3 % |
| Consumidos con evidencia real (API o pantalla) | / consumidos | 57 de 68 = 83,8 % |
| RNF completos | completos / 10 | 0 de 10 (parciales 3, por validar 6, fuera de alcance 1) |

La columna Frontend supera a la Global porque varias pantallas están hechas pero el requerimiento sigue abierto por el backend, por una decisión o por falta de prueba real.

Los porcentajes cuentan requerimientos y endpoints por igual: no miden esfuerzo restante.

## 3. Matriz consolidada de requerimientos funcionales

Integración: «API» = respuesta correcta en scripts; «UI» = pantalla cargada contra el backend real en esta auditoría.

| ID | Requerimiento | Backend | Frontend | Integración real | Estado global | Evidencia | Pendientes |
|---|---|---|---|---|---|---|---|
| RF-01 | Registro, inicio y cierre de sesión | Parcial | Completo | API #2; UI #3; sin probar #1 | **IMPLEMENTADO PARCIALMENTE** | features/auth (login, registro), user-menu (cerrar sesión), auth/guest guards | Registro sin integración en esta auditoría; el backend no tiene cierre de sesión ni revocación. |
| RF-02 | Cambio de rol de trabajador a cliente | Verificado | Completo | UI #3 | **PENDIENTE DE VALIDACIÓN** | user-menu (áreas por rol), role.guard | Cambio de área sin prueba manual en esta auditoría. |
| RF-03 | Funciones de trabajador solo con perfil aprobado | Verificado | Completo | API #30, #52, #69; UI #30, #52 | **COMPLETO Y VERIFICADO** | approved-worker.guard, worker-home-page; pendiente redirigido en navegador; 403 en scripts | — |
| RF-04 | Creación interna de administradores | Parcial | No implementado | — | **NO IMPLEMENTADO** | Sin pantalla ni servicio | Alta de administradores (backend también parcial). |
| RF-05 | Recuperación de contraseña | Pendiente | No implementado | — | **BLOQUEADO POR DECISIÓN EXTERNA** | Sin pantalla | Falta decidir canal, proveedor, formato y vigencia. |
| RF-06 | Datos del perfil del trabajador | Verificado | Completo | API #24; UI #24; sin probar #23, #25, #26, #27, #28 | **PENDIENTE DE VALIDACIÓN** | become-worker-page, my-worker-profile-page y sus formularios | Escrituras #23, #25–#28 sin integración real. |
| RF-07 | Documentación de respaldo | Verificado | Completo | UI #31; sin probar #32, #33, #34 | **PENDIENTE DE VALIDACIÓN** | worker-documents-panel | Subida, reemplazo y descarga sin integración real. |
| RF-08 | Estados del perfil | Verificado | Parcial | API #24; UI #24, #29 | **PENDIENTE DE VALIDACIÓN** | Estado y motivo en inicio y perfil del trabajador | Observado y Rechazado sin verificar; cambiar estados es RF-10. |
| RF-09 | Ocultar perfiles no aprobados | Verificado | Parcial | API #52, #53; UI #52, #53 | **IMPLEMENTADO PARCIALMENTE** | Visibilidad de pedidos (scripts E1/E2) | El criterio de búsqueda por clientes no es observable (sin RF-16). |
| RF-10 | Revisión y decisión sobre el perfil | Verificado | No implementado | — | **NO IMPLEMENTADO** | Menú «Verificación de trabajadores» como Próximamente | Panel de revisión (#35–#41 y relacionados). |
| RF-11 | Perfil público | Parcial | No implementado | — | **NO IMPLEMENTADO** | Sin perfil público | #106, #107. |
| RF-12 | Indicación de perfil revisado | Pendiente | No implementado | — | **BLOQUEADO POR DECISIÓN EXTERNA** | Sin texto de lo revisado | Texto pendiente del docente. |
| RF-13 | Zona fija y cambio por solicitud | Verificado | Parcial | API #30; UI #30 | **IMPLEMENTADO PARCIALMENTE** | Zona al crear el perfil; aviso de solicitud pendiente | Crear y retirar solicitud de cambio; resolución administrativa. |
| RF-14 | Creación de un pedido | Verificado | Completo | API #42 | **COMPLETO Y VERIFICADO** | publish-order-page; E1 | — |
| RF-15 | Varios pedidos activos | Verificado | Completo | API #42, #44; UI #44; sin probar #43 | **PENDIENTE DE VALIDACIÓN** | publish-order-page (avisos), my-orders-page | El aviso de categoría repetida (#43) no se probó contra el backend. |
| RF-16 | Búsqueda de trabajadores | Verificado | No implementado | — | **NO IMPLEMENTADO** | Sin buscador | #114. |
| RF-17 | Visibilidad del pedido | Verificado | Completo | API #52, #53, #54; UI #52, #53, #54 | **COMPLETO Y VERIFICADO** | available-orders-page; E1, E2 | — |
| RF-18 | Edición y cancelación sin acuerdo | Parcial | Completo | API #47, #48, #49, #50, #51 | **IMPLEMENTADO PARCIALMENTE** | edit-order-page, order-photo-manager, cancel-order; E1 | El backend no avisa a quienes ofertaron. |
| RF-19 | Envío de una oferta | Verificado | Completo | API #69 | **COMPLETO Y VERIFICADO** | create-offer-page; E2 | — |
| RF-20 | Aceptar, rechazar o contraofertar | Parcial | Completo | API #74, #75, #76, #77 | **IMPLEMENTADO PARCIALMENTE** | offer-actions; E2 | No existe «Sin acuerdo» (decisión del equipo). |
| RF-21 | Historial de la negociación | Verificado | Completo | API #71, #73, #112; UI #71, #73, #112 | **COMPLETO Y VERIFICADO** | negotiation-timeline, historial; E2 | — |
| RF-22 | Condiciones claras antes de aceptar | Verificado | Completo | API #73; UI #73 | **COMPLETO Y VERIFICADO** | offer-detail-page | — |
| RF-23 | Vigencia y máximo de rondas | Parcial | Completo | API #71, #73, #74; UI #71, #73 | **IMPLEMENTADO PARCIALMENTE** | Ronda y vencimiento en el detalle; E2 | 24 h y 3 rondas no configurables. |
| RF-24 | Cotización por fotos o visita | Verificado | Completo | API #69 | **COMPLETO Y VERIFICADO** | create-offer-page (fotos o visita); E2 | — |
| RF-25 | Cobro de la visita | Verificado | Completo | API #83, #84, #101 | **COMPLETO Y VERIFICADO** | worker-actions, confirm-visit-payment; E3.3 A | — |
| RF-26 | Presupuesto adicional | Verificado | Completo | API #86, #88 | **COMPLETO Y VERIFICADO** | additional-budget-form, budget-response; E3.3 B | — |
| RF-27 | Rechazo del adicional | Parcial | Completo | API #113 | **IMPLEMENTADO PARCIALMENTE** | budget-response; E3.3 B | Contraoferta del adicional sin definir. |
| RF-28 | Terminado y conformidad | Verificado | Parcial | API #85, #87, #89 | **IMPLEMENTADO PARCIALMENTE** | worker-actions, conformity-panel; E3.3 C | El cliente no ve avisos (RF-33); cierre automático no probado (tareas apagadas). |
| RF-29 | Días y horarios de atención | Verificado | Completo | sin probar #27 | **PENDIENTE DE VALIDACIÓN** | schedules-form, schedule-editor (superposiciones) | #27 sin integración real. El docente indicó que no limitan ofertas. |
| RF-30 | Prevención de cruces | Verificado | Completo | API #77 | **COMPLETO Y VERIFICADO** | Mensaje 409 al aceptar; E2 «RF-30» | — |
| RF-31 | Duración estimada | Parcial | Completo | API #69 | **IMPLEMENTADO PARCIALMENTE** | Duración en oferta y trabajo | Extensión de la duración sin definir. |
| RF-32 | Línea de tiempo | Verificado | Completo | API #112; UI #112 | **COMPLETO Y VERIFICADO** | service-timeline, service-history; E3.1 | — |
| RF-33 | Notificaciones internas | Verificado | No implementado | — | **NO IMPLEMENTADO** | Sin pantalla de notificaciones | #61–#64. |
| RF-34 | Cancelación del trabajo | Parcial | Completo | API #90 | **IMPLEMENTADO PARCIALMENTE** | client-actions; E3.4 A | Regla del anticipo (docente). |
| RF-35 | Vencimiento del pedido | Parcial | Parcial | API #44, #45; UI #44, #45 | **IMPLEMENTADO PARCIALMENTE** | Estado «Vencido» y fecha en el detalle | Sin aviso en pantalla ni republicación. |
| RF-36 | Trabajador que no llega | Parcial | Completo | API #91 | **IMPLEMENTADO PARCIALMENTE** | client-actions; E3.4 B | Tolerancia y efecto en la calificación. |
| RF-37 | Presentación de un reclamo | Verificado | Completo | API #92, #93, #94; UI #93, #94 | **COMPLETO Y VERIFICADO** | claim-form, claim-panel; E3.5 A y B | Límite de fotos por confirmar. |
| RF-38 | Atención del reclamo | Parcial | Completo | API #95, #96, #97, #98; UI #95, #96 | **IMPLEMENTADO PARCIALMENTE** | admin-claim-page, claim-resolution; E3.5 C y D | Sin canal para pedir más información. |
| RF-39 | Registro del anticipo | Verificado | Parcial | API #101 | **IMPLEMENTADO PARCIALMENTE** | payments-section; E3.2 | Sin advertencia explícita al no poder iniciar un trabajo sin visita en «Acordado». |
| RF-40 | Confirmación del pago final | Verificado | Completo | API #101 | **COMPLETO Y VERIFICADO** | declare-payment-form; E3.2 | Pago parcial por confirmar. |
| RF-41 | Constancias | Parcial | Parcial | API #100; UI #100 | **IMPLEMENTADO PARCIALMENTE** | receipts-list; E3.2 | No se puede subir un comprobante. |
| RF-42 | Confirmación «Ya pagué» | Parcial | Parcial | API #99, #101; UI #99 | **IMPLEMENTADO PARCIALMENTE** | Comparación de declaraciones; E3.2 | No hay estado «conciliado». |
| RF-43 | Aviso de pago directo | Verificado | Completo | API #99, #101; UI #99 | **COMPLETO Y VERIFICADO** | Aviso de pago directo en Pagos | — |
| RF-44 | Calificación mutua | Parcial | No implementado | — | **BLOQUEADO POR DECISIÓN EXTERNA** | Sin pantalla | Calificaciones deshabilitadas hasta definir estados. |
| RF-45 | Calificar solo trabajos terminados | Parcial | No implementado | — | **BLOQUEADO POR DECISIÓN EXTERNA** | Sin pantalla | Misma decisión que RF-44. |
| RF-46 | Promedio y opiniones | Verificado | No implementado | — | **NO IMPLEMENTADO** | Sin pantalla | #106, #107. |
| RF-47 | Gestión y suspensión de trabajadores | Parcial | No implementado | — | **NO IMPLEMENTADO** | Menú Próximamente | Gestión y suspensión de trabajadores. |
| RF-48 | Categorías | Verificado | No implementado | UI #8 | **NO IMPLEMENTADO** | Solo listado público de categorías | Gestión administrativa de categorías. |
| RF-49 | Zonas | Verificado | No implementado | UI #10 | **NO IMPLEMENTADO** | Zonas solo en formularios | Gestión administrativa de zonas. |
| RF-50 | Supervisión de pedidos | Parcial | No implementado | API #68; UI #68 | **NO IMPLEMENTADO** | Solo el pedido dentro de un reclamo | Listado y filtros de pedidos. |
| RF-51 | Panel de reclamos | Parcial | Parcial | API #95; UI #95 | **IMPLEMENTADO PARCIALMENTE** | admin-claims-page (antigüedad, filtro) | La vista inicial incluye resueltos; no destaca urgentes (falta umbral). |
| RF-52 | Reportes | Verificado | No implementado | — | **NO IMPLEMENTADO** | Sin pantalla | #115. |
| RF-53 | Bitácora | Parcial | No implementado | — | **NO IMPLEMENTADO** | Menú Próximamente | Consulta de bitácora. |
| RF-54 | Información pública para visitantes | Verificado | Parcial | UI #8 | **IMPLEMENTADO PARCIALMENTE** | Inicio, «Cómo funciona», categorías | Perfil público y opiniones. |
| RF-55 | Dirección exacta | Verificado | Completo | API #45, #80; UI #45, #80 | **COMPLETO Y VERIFICADO** | assigned-order; E1, E2 | — |
| RF-56 | Documentación restringida | Verificado | Parcial | UI #31; sin probar #34 | **IMPLEMENTADO PARCIALMENTE** | El trabajador ve sus documentos | Consulta del administrador y su registro; sin integración real de documentos. |

## 4. Requerimientos no funcionales

| ID | Requerimiento | Backend (matriz) | Estado global | Se verifica desde | Evidencia | Pendientes |
|---|---|---|---|---|---|---|
| RNF-01 | Seguridad | Verificado | **PENDIENTE DE VALIDACIÓN** | Backend y pruebas de acceso | Guards, interceptor, token en sessionStorage, sin innerHTML ni bypass; 401/403/404 reales en scripts | La métrica exige 100 % de funciones con control de rol probado; hay integración de 53 de 115. |
| RNF-02 | Privacidad | Verificado | **PENDIENTE DE VALIDACIÓN** | Backend y sistema completo | Dirección solo al asignado y fotos de reclamo privadas (scripts E1, E3.5) | Acceso a documentos sin prueba en esta auditoría. |
| RNF-03 | Usabilidad | No aplica | **IMPLEMENTADO PARCIALMENTE** | Frontend y pruebas con personas | 24 visitas a 360 px sin desplazamiento horizontal ni infracciones de axe; textos en español | Prueba con 5 personas; algunos mensajes del backend en inglés. |
| RNF-04 | Rendimiento | No aplica | **PENDIENTE DE VALIDACIÓN** | Sistema completo | Carga inicial 323,85 kB (91 kB transferidos) y rutas diferidas | Sin 10 mediciones con red móvil; el umbral está por confirmar. |
| RNF-05 | Disponibilidad | No aplica | **FUERA DE ALCANCE** | Proceso del equipo | La métrica es informar interrupciones; no tiene código | Definir quién informa durante las pruebas. |
| RNF-06 | Compatibilidad | No aplica | **PENDIENTE DE VALIDACIÓN** | Sistema completo | Revisado solo en el navegador integrado (Chromium) | Chrome, Firefox y Edge. |
| RNF-07 | Trazabilidad | Verificado | **PENDIENTE DE VALIDACIÓN** | Backend | Historial con actor y fecha comprobado en scripts E3 | Revisión formal de la muestra; bitácora sin pantalla. |
| RNF-08 | Transparencia | Parcial | **IMPLEMENTADO PARCIALMENTE** | Frontend y backend | Sin afirmaciones de verificación; los avisos dicen que no se garantiza dinero | Hay las palabras «garantiza» (en negaciones) y «Certificado» (tipo de documento): confirmar la métrica literal. Falta el texto de RF-12. |
| RNF-09 | Mantenibilidad | Parcial | **IMPLEMENTADO PARCIALMENTE** | Repositorios | TypeScript, features, lint y Prettier correctos; backend ya confirmado en Git | Dos commits publicados comparten el título «Visitas, presupuestos…»; `main` local sin publicar; sin `.gitattributes`. |
| RNF-10 | Evolución | Parcial | **PENDIENTE DE VALIDACIÓN** | Base de datos | No verificable desde el frontend | Revisión formal del modelo. |

## 5. Endpoints (115)

Integración: **API y UI** (scripts y pantalla), **API** (solo scripts), **UI** (solo pantalla), **Sin probar** (consumido, sin evidencia real aquí), **No consumido**.

### Resumen por módulo

| Módulo | Total | Consumidos | Con evidencia real |
|---|---|---|---|
| AuthModule | 3 | 3 | 2 |
| UsersModule | 4 | 2 | 1 |
| CatalogsModule | 14 | 2 | 2 |
| AuditModule | 1 | 0 | 0 |
| WorkerProfileModule | 27 | 12 | 4 |
| OrdersModule | 17 | 16 | 15 |
| NotificationsModule | 4 | 0 | 0 |
| OffersModule | 11 | 11 | 11 |
| Flujo del trabajo | 10 | 10 | 10 |
| Pagos | 5 | 4 | 4 |
| Reclamos | 7 | 7 | 7 |
| Calificaciones | 6 | 0 | 0 |
| Calificaciones y búsqueda | 2 | 0 | 0 |
| Agenda | 2 | 0 | 0 |
| Seguimiento | 1 | 1 | 1 |
| Reportes | 1 | 0 | 0 |

### Detalle

| # | Método y ruta | Módulo | Consumido | Servicio Angular | Pantalla o componente | Integración | Observaciones |
|---|---|---|---|---|---|---|---|
| 1 | `POST /api/auth/register` | AuthModule | Sí | `AuthService.register` | register-page | Sin probar | — |
| 2 | `POST /api/auth/login` | AuthModule | Sí | `AuthService.login` | login-page | API | Scripts: e1, e2, e2-paginacion, e31… |
| 3 | `GET /api/auth/me` | AuthModule | Sí | `AuthService.getCurrentUser` | account-page, become-worker-page | UI | — |
| 4 | `GET /api/users` | UsersModule | No | — | — | No consumido | — |
| 5 | `GET /api/users/:id` | UsersModule | No | — | — | No consumido | — |
| 6 | `PATCH /api/users/:id` | UsersModule | Sí | `UsersApiService.updateUser` | account-page | API | Scripts: e2 |
| 7 | `PATCH /api/users/:id/status` | UsersModule | Sí | `UsersApiService.deactivateOwnAccount` | deactivate-account | Sin probar | — |
| 8 | `GET /api/catalogs/categories` | CatalogsModule | Sí | `CatalogsApiService.getCategories` | categories-page, public-home-page, available-orders-page, edit-order-page, publish-order-page, become-worker-page, my-worker-profile-page | UI | — |
| 9 | `GET /api/catalogs/categories/:id` | CatalogsModule | No | `CatalogsApiService.getCategory` | — | No consumido | El servicio existe pero ninguna pantalla lo usa |
| 10 | `GET /api/catalogs/zones` | CatalogsModule | Sí | `CatalogsApiService.getZones` | publish-order-page, become-worker-page, my-worker-profile-page | UI | — |
| 11 | `GET /api/catalogs/zones/:id` | CatalogsModule | No | `CatalogsApiService.getZone` | — | No consumido | El servicio existe pero ninguna pantalla lo usa |
| 12 | `GET /api/catalogs/admin/categories` | CatalogsModule | No | — | — | No consumido | — |
| 13 | `GET /api/catalogs/admin/categories/:id` | CatalogsModule | No | — | — | No consumido | — |
| 14 | `GET /api/catalogs/admin/zones` | CatalogsModule | No | — | — | No consumido | — |
| 15 | `GET /api/catalogs/admin/zones/:id` | CatalogsModule | No | — | — | No consumido | — |
| 16 | `POST /api/catalogs/categories` | CatalogsModule | No | — | — | No consumido | Probado por scripts; sin uso en el frontend; Scripts: e1 |
| 17 | `PATCH /api/catalogs/categories/:id` | CatalogsModule | No | — | — | No consumido | — |
| 18 | `PATCH /api/catalogs/categories/:id/deactivate` | CatalogsModule | No | — | — | No consumido | Probado por scripts; sin uso en el frontend; Scripts: e1 |
| 19 | `POST /api/catalogs/zones` | CatalogsModule | No | — | — | No consumido | — |
| 20 | `PATCH /api/catalogs/zones/:id` | CatalogsModule | No | — | — | No consumido | — |
| 21 | `PATCH /api/catalogs/zones/:id/deactivate` | CatalogsModule | No | — | — | No consumido | — |
| 22 | `GET /api/audit-logs` | AuditModule | No | — | — | No consumido | — |
| 23 | `POST /api/worker-profile` | WorkerProfileModule | Sí | `WorkerProfileApiService.createProfile` | become-worker-page | Sin probar | — |
| 24 | `GET /api/worker-profile/me` | WorkerProfileModule | Sí | `WorkerProfileApiService.getOwnProfile` | become-worker-page, my-worker-profile-page | API y UI | Scripts: e2 |
| 25 | `PATCH /api/worker-profile/me` | WorkerProfileModule | Sí | `WorkerProfileApiService.updateProfile` | profile-details-form | Sin probar | — |
| 26 | `PUT /api/worker-profile/me/specialties` | WorkerProfileModule | Sí | `WorkerProfileApiService.replaceSpecialties` | specialties-form | Sin probar | — |
| 27 | `PUT /api/worker-profile/me/schedules` | WorkerProfileModule | Sí | `WorkerProfileApiService.replaceSchedules` | schedules-form | Sin probar | — |
| 28 | `POST /api/worker-profile/me/submit` | WorkerProfileModule | Sí | `WorkerProfileApiService.submitForReview` | submit-review | Sin probar | — |
| 29 | `GET /api/worker-profile/me/status` | WorkerProfileModule | Sí | `WorkerProfileApiService.getStatus` | my-worker-profile-page | UI | — |
| 30 | `GET /api/worker-profile/me/eligibility` | WorkerProfileModule | Sí | `WorkerProfileApiService.getEligibility` | worker-home-page, available-orders-page, create-offer-page, my-worker-profile-page, job-page | API y UI | Scripts: e33a |
| 31 | `GET /api/worker-profile/me/documents` | WorkerProfileModule | Sí | `WorkerDocumentsApiService.list` | worker-documents-panel | UI | — |
| 32 | `POST /api/worker-profile/me/documents` | WorkerProfileModule | Sí | `WorkerDocumentsApiService.upload` | worker-documents-panel | Sin probar | — |
| 33 | `POST /api/worker-profile/me/documents/:documentId/replace` | WorkerProfileModule | Sí | `WorkerDocumentsApiService.replace` | worker-documents-panel | Sin probar | — |
| 34 | `GET /api/worker-profile/me/documents/:documentId/download` | WorkerProfileModule | Sí | `WorkerDocumentsApiService.download` | worker-documents-panel | Sin probar | — |
| 35 | `GET /api/worker-profile/me/zone` | WorkerProfileModule | No | — | — | No consumido | — |
| 36 | `POST /api/worker-profile/me/zone-change-requests` | WorkerProfileModule | No | — | — | No consumido | — |
| 37 | `GET /api/worker-profile/me/zone-change-requests` | WorkerProfileModule | No | — | — | No consumido | — |
| 38 | `GET /api/worker-profile/admin/zone-change-requests` | WorkerProfileModule | No | — | — | No consumido | — |
| 39 | `GET /api/worker-profile/admin/zone-change-requests/:requestId` | WorkerProfileModule | No | — | — | No consumido | — |
| 40 | `PATCH /api/worker-profile/admin/zone-change-requests/:requestId` | WorkerProfileModule | No | — | — | No consumido | — |
| 41 | `GET /api/worker-profile/admin/inactive-zone-profiles` | WorkerProfileModule | No | — | — | No consumido | — |
| 42 | `POST /api/orders` | OrdersModule | Sí | `OrdersApiService.createOrder` | publish-order-page | API | Scripts: e1, e2, e32, e33a… |
| 43 | `POST /api/orders/duplicate-check` | OrdersModule | Sí | `OrdersApiService.checkDuplicates` | publish-order-page | Sin probar | Se usa al publicar un pedido |
| 44 | `GET /api/orders/me` | OrdersModule | Sí | `OrdersApiService.listOwn` | client-home-page, offers-page, my-orders-page | API y UI | Scripts: e1, e2-paginacion |
| 45 | `GET /api/orders/me/:orderId` | OrdersModule | Sí | `OrdersApiService.getOwn` | offer-detail-page, edit-order-page, order-detail-page, tracking-page | API y UI | Scripts: e1, e2, e31 |
| 46 | `GET /api/orders/me/:orderId/images/:imageId` | OrdersModule | Sí | `OrdersApiService.getImage` | order-gallery, order-photo | API y UI | Scripts: e1 |
| 47 | `PATCH /api/orders/me/:orderId` | OrdersModule | Sí | `OrdersApiService.update` | edit-order-page | API | Scripts: e1 |
| 48 | `POST /api/orders/me/:orderId/images` | OrdersModule | Sí | `OrdersApiService.addImage` | order-photo-manager | API | Scripts: e1 |
| 49 | `PUT /api/orders/me/:orderId/images/:imageId` | OrdersModule | Sí | `OrdersApiService.replaceImage` | order-photo-manager | API | Scripts: e1 |
| 50 | `DELETE /api/orders/me/:orderId/images/:imageId` | OrdersModule | Sí | `OrdersApiService.deleteImage` | order-photo-manager | API | Scripts: e1 |
| 51 | `POST /api/orders/me/:orderId/cancel` | OrdersModule | Sí | `OrdersApiService.cancel` | cancel-order | API | Scripts: e1, e2 |
| 52 | `GET /api/orders/available` | OrdersModule | Sí | `OrdersApiService.listAvailable` | available-orders-page, offers-page | API y UI | Scripts: e2, e2-paginacion |
| 53 | `GET /api/orders/available/:orderId` | OrdersModule | Sí | `OrdersApiService.getAvailable` | available-order-page, create-offer-page, offer-detail-page | API y UI | Scripts: e2, e2-paginacion |
| 54 | `GET /api/orders/available/:orderId/images/:imageId` | OrdersModule | Sí | `OrdersApiService.getImage` | order-gallery, order-photo | API y UI | Scripts: e2 |
| 55 | `PATCH /api/worker-profile/admin/profiles/:profileId/status` | WorkerProfileModule | No | — | — | No consumido | — |
| 56 | `GET /api/worker-profile/admin/profiles` | WorkerProfileModule | No | — | — | No consumido | — |
| 57 | `GET /api/worker-profile/admin/profiles/:profileId` | WorkerProfileModule | No | — | — | No consumido | — |
| 58 | `GET /api/worker-profile/admin/profiles/:profileId/documents` | WorkerProfileModule | No | — | — | No consumido | — |
| 59 | `GET /api/worker-profile/admin/profiles/:profileId/documents/:documentId/view` | WorkerProfileModule | No | — | — | No consumido | — |
| 60 | `GET /api/worker-profile/admin/profiles/:profileId/documents/:documentId/download` | WorkerProfileModule | No | — | — | No consumido | — |
| 61 | `GET /api/notifications` | NotificationsModule | No | — | — | No consumido | — |
| 62 | `GET /api/notifications/unread-count` | NotificationsModule | No | — | — | No consumido | — |
| 63 | `PATCH /api/notifications/:notificationId/read` | NotificationsModule | No | — | — | No consumido | — |
| 64 | `PATCH /api/notifications/read-all` | NotificationsModule | No | — | — | No consumido | — |
| 65 | `POST /api/worker-profile/me/zone-change-requests/:requestId/withdraw` | WorkerProfileModule | No | — | — | No consumido | — |
| 66 | `PATCH /api/worker-profile/admin/profiles/:profileId/zone` | WorkerProfileModule | No | — | — | No consumido | — |
| 67 | `GET /api/orders/admin` | OrdersModule | No | — | — | No consumido | — |
| 68 | `GET /api/orders/admin/:orderId` | OrdersModule | Sí | `OrdersApiService.getForAdmin` | admin-claim-page | API y UI | Scripts: e35c |
| 69 | `POST /api/offers/orders/:orderId` | OffersModule | Sí | `OffersApiService.create` | create-offer-page | API | Scripts: e1, e2, e2-paginacion, e32… |
| 70 | `GET /api/offers/me` | OffersModule | Sí | `OffersApiService.listOwn` | offers-page, assigned-jobs-page | API y UI | Scripts: e2, e2-paginacion, e31 |
| 71 | `GET /api/offers/me/:offerId` | OffersModule | Sí | `OffersApiService.getOwn` | offer-detail-page | API y UI | Scripts: e2, e31 |
| 72 | `GET /api/offers/received` | OffersModule | Sí | `OffersApiService.listReceived` | order-offers, offers-page, tracking-page | API y UI | Scripts: e2, e31 |
| 73 | `GET /api/offers/received/:offerId` | OffersModule | Sí | `OffersApiService.getReceived` | offer-detail-page | API y UI | Scripts: e1, e2 |
| 74 | `POST /api/offers/:offerId/counter` | OffersModule | Sí | `OffersApiService.counter` | offer-actions | API | Scripts: e2 |
| 75 | `POST /api/offers/:offerId/reject` | OffersModule | Sí | `OffersApiService.reject` | offer-actions | API | Scripts: e2 |
| 76 | `POST /api/offers/:offerId/withdraw` | OffersModule | Sí | `OffersApiService.withdraw` | offer-actions | API | Scripts: e2 |
| 77 | `POST /api/offers/:offerId/accept` | OffersModule | Sí | `OffersApiService.accept` | offer-actions | API | Scripts: e2, e32, e33a, e33b… |
| 78 | `GET /api/offers/received/:offerId/whatsapp` | OffersModule | Sí | `OffersApiService.getWorkerContact` | whatsapp-contact | API y UI | Scripts: e2, e31 |
| 79 | `GET /api/offers/me/:offerId/whatsapp` | OffersModule | Sí | `OffersApiService.getClientContact` | whatsapp-contact | API y UI | Scripts: e2, e31, e34a |
| 80 | `GET /api/orders/assigned/:orderId` | OrdersModule | Sí | `OrdersApiService.getAssigned` | assigned-order, assigned-jobs-page | API y UI | Scripts: e2, e31, e34a |
| 81 | `GET /api/orders/assigned/:orderId/images/:imageId` | OrdersModule | Sí | `OrdersApiService.getImage` | order-gallery, order-photo | UI | — |
| 82 | `GET /api/orders/:orderId/workflow` | Flujo del trabajo | Sí | `WorkflowApiService.get` | assigned-jobs-page, service-work.store | API y UI | Scripts: e31, e33a, e33b, e33c… |
| 83 | `POST /api/orders/:orderId/visit` | Flujo del trabajo | Sí | `WorkflowApiService.registerVisit` | worker-actions | API | Scripts: e32, e33a, e33b, e33c… |
| 84 | `POST /api/orders/:orderId/visit/payment-confirmation` | Pagos | Sí | `WorkflowApiService.confirmVisitPayment` | confirm-visit-payment | API | Scripts: e33a, e33b, e34a |
| 85 | `POST /api/orders/:orderId/start` | Flujo del trabajo | Sí | `WorkflowApiService.startWork` | worker-actions | API | Scripts: e32, e33b, e33c, e34a… |
| 86 | `POST /api/orders/:orderId/additional-budgets` | Flujo del trabajo | Sí | `WorkflowApiService.proposeBudget` | additional-budget-form | API | Scripts: e32, e33b, e33c, e34a |
| 87 | `POST /api/orders/:orderId/finish` | Flujo del trabajo | Sí | `WorkflowApiService.finishWork` | worker-actions | API | Scripts: e32, e33b, e33c, e34a… |
| 88 | `POST /api/orders/:orderId/additional-budgets/:budgetId/accept` | Flujo del trabajo | Sí | `WorkflowApiService.acceptBudget` | budget-response | API | Scripts: e33b |
| 89 | `POST /api/orders/:orderId/confirm-conformity` | Flujo del trabajo | Sí | `WorkflowApiService.confirmConformity` | conformity-panel | API | Scripts: e33c, e35a |
| 90 | `POST /api/orders/:orderId/cancel-work` | Flujo del trabajo | Sí | `WorkflowApiService.cancelWork` | client-actions | API | Scripts: e32, e33a, e33b, e34a… |
| 91 | `POST /api/orders/:orderId/no-show` | Flujo del trabajo | Sí | `WorkflowApiService.reportNoShow` | client-actions | API | Scripts: e34b |
| 92 | `POST /api/orders/:orderId/claims` | Reclamos | Sí | `ClaimsApiService.create` | claim-form | API | Scripts: e35a, e35b, e35c, e35d |
| 93 | `GET /api/orders/:orderId/claim` | Reclamos | Sí | `ClaimsApiService.getForOrder` | claim-panel | API y UI | Scripts: e35b, e35d |
| 94 | `GET /api/claims/:claimId/images/:imageId` | Reclamos | Sí | `ClaimsApiService.getImage` | claim-detail | API y UI | Scripts: e35b |
| 95 | `GET /api/admin/claims` | Reclamos | Sí | `ClaimsApiService.list` | admin-claims-page | API y UI | Scripts: e35c |
| 96 | `GET /api/admin/claims/:claimId` | Reclamos | Sí | `ClaimsApiService.get` | admin-claim-page | API y UI | Scripts: e35c |
| 97 | `POST /api/admin/claims/:claimId/review` | Reclamos | Sí | `ClaimsApiService.markInReview` | claim-resolution | API | Scripts: e35d |
| 98 | `POST /api/admin/claims/:claimId/decision` | Reclamos | Sí | `ClaimsApiService.decide` | claim-resolution | API | Scripts: e35d |
| 99 | `GET /api/orders/:orderId/payments` | Pagos | Sí | `PaymentsApiService.getOverview` | payments-section | API y UI | Scripts: e32, e33a, e33b |
| 100 | `GET /api/orders/:orderId/receipts` | Pagos | Sí | `PaymentsApiService.getReceipts` | admin-claim-page, payments-section | API y UI | Scripts: e32, e35c |
| 101 | `POST /api/orders/:orderId/payments/:concept/declarations` | Pagos | Sí | `PaymentsApiService.declare` | declare-payment-form | API | Scripts: e32, e33a, e33b, e33c… |
| 102 | `GET /api/admin/payments/differences` | Pagos | No | — | — | No consumido | — |
| 103 | `POST /api/orders/:orderId/reviews` | Calificaciones | No | — | — | No consumido | — |
| 104 | `GET /api/orders/:orderId/reviews/mine` | Calificaciones | No | — | — | No consumido | — |
| 105 | `GET /api/reviews/received` | Calificaciones | No | — | — | No consumido | — |
| 106 | `GET /api/workers/:workerId/public-profile` | Calificaciones y búsqueda | No | — | — | No consumido | — |
| 107 | `GET /api/workers/:workerId/reviews` | Calificaciones | No | — | — | No consumido | — |
| 108 | `GET /api/admin/reviews` | Calificaciones | No | — | — | No consumido | — |
| 109 | `PATCH /api/admin/reviews/:reviewId/hide` | Calificaciones | No | — | — | No consumido | — |
| 110 | `GET /api/agenda/me` | Agenda | No | — | — | No consumido | — |
| 111 | `POST /api/agenda/me/check` | Agenda | No | — | — | No consumido | — |
| 112 | `GET /api/orders/:orderId/timeline` | Seguimiento | Sí | `TimelineApiService.get` | service-work.store | API y UI | Scripts: e31, e33a, e33b, e33c… |
| 113 | `POST /api/orders/:orderId/additional-budgets/:budgetId/reject` | Flujo del trabajo | Sí | `WorkflowApiService.rejectBudget` | budget-response | API | Scripts: e32, e33b |
| 114 | `GET /api/workers/search` | Calificaciones y búsqueda | No | — | — | No consumido | — |
| 115 | `GET /api/admin/reports/:type` | Reportes | No | — | — | No consumido | — |

**Consumidos sin evidencia real en esta auditoría (11):** #1, #7, #23, #25, #26, #27, #28, #32, #33, #34, #43 (registro, desactivación de la cuenta propia, escrituras y documentos del perfil de trabajador, y detección de pedidos duplicados).

## 6. Pendientes priorizados

1. **Sin interfaz:** verificación de trabajadores (RF-10, RF-47), notificaciones (RF-33), administración de categorías, zonas, usuarios, pedidos y bitácora (RF-48 a RF-50, RF-53, RF-04), reportes (RF-52), búsqueda y perfil público (RF-16, RF-11, RF-46).
2. **Validación pendiente de lo ya construido:** integración real de registro, perfil y documentos del trabajador.
3. **Huecos en pantallas existentes:** solicitudes de cambio de zona (RF-13), advertencia del anticipo (RF-39), vista de pendientes en reclamos (RF-51).
4. **Decisiones externas:** RF-05, RF-12, RF-44 y RF-45; además anticipo al cancelar, tolerancia de inasistencia y contraoferta del adicional.
5. **Calidad:** pruebas en Firefox y Edge, rendimiento, lector de pantalla, prueba de uso con personas.

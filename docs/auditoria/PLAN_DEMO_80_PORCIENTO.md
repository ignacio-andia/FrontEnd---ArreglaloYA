# Plan de cierre funcional — 80 % demostrable

> **Estado al 25/11/2026: D0–D4 ejecutadas.** 47 de 56 demostrables (83,9 %) y 28 formalmente completos (50,0 %). Las secciones 0 a 6 conservan la planificación original; el resultado está en las secciones 9 y 10.

Fecha: 25/11/2026 · `main` en `fac0e3a` · Base: [auditoría del frontend](AUDITORIA_FRONTEND.md) y matriz del backend. Solo planificación: no se modificó código.

## 0. Resumen

- **Meta:** al menos **45 de 56 requerimientos demostrables** (80,4 %).
- **Punto de partida:** 28 de 56 (50,0 %) con flujo principal en pantalla, que deben confirmarse en el ensayo de D0.
- **Camino recomendado:** D0 → D1 → D2 → D3 llega a 45. Sumar D4 deja **47 (83,9 %)**, con margen de dos por si alguno falla en el ensayo.
- **Ninguna etapa exige cambiar el backend ni las migraciones.** D7 solo necesita una variable de configuración.
- **«Demostrable» no es «completo».** Con la definición estricta de la auditoría, tras D3 habría alrededor de 26 de 56 completos. En la defensa conviene decir las dos cifras.

### Regla de conteo

Un requerimiento cuenta como demostrable (1, sin medios puntos) solo si tiene **pantalla funcional, acción ejecutable, respuesta visible, datos persistentes cuando corresponda y permisos básicos respetados**, comprobado en la interfaz contra el backend. Puede tener criterios secundarios pendientes, que se declaran (sección 6). El denominador es 56: los bloqueados también cuentan en contra.

Esta cifra **no es comparable** con el 49,1 % ponderado de la auditoría, que usa otra fórmula.

## 1. Estado actual

| Indicador (auditoría) | Valor |
|---|---|
| Completos y verificados | 15 de 56 |
| Parciales / por validar / no implementados / bloqueados | 19 / 6 / 12 / 4 |
| Endpoints consumidos | 68 de 115 |
| Consumidos sin prueba real | 11: #1, #7, #23, #25–#28, #32–#34, #43 |

### Clasificación de los 56 RF

| Grupo | Cantidad | Requerimientos |
|---|---|---|
| A. Demostrables hoy | 28 | 03, 14, 17–28, 30–32, 34, 36–43, 51, 55 |
| B. Parciales o por validar que se cierran rápido (D0) | 7 | 01, 02, 06, 07, 08, 15, 29 |
| C. Faltantes o incompletos de coste razonable, dentro del camino a 80 % (D1–D3) | 10 | 09, 10, 11, 16, 47, 50, 52, 53, 54, 56 |
| C2. Margen y mejoras (D4–D6) | 4 | 13, 33, 48, 49 |
| D. Dependen de una decisión del equipo o del docente (D7) | 3 | 44, 45, 46 |
| E. Poco rentables o no viables ahora | 2 | 04 (el backend solo crea el primer administrador por comando), 35 (no existe republicar; ver reserva) |
| F. Bloqueados | 2 | 05, 12 |

Los bloqueados de la auditoría eran 05, 12, 44 y 45: aquí 44 y 45 pasan al grupo D porque el backend puede habilitarlos por configuración.

**Salvedad del grupo A.** La auditoría probó la API con scripts y recorrió las pantallas solo en lectura. Las escrituras de E3.2 a E3.5 se probaron en el navegador en etapas anteriores; las de pedidos y ofertas (E1, E2) no se repitieron en la interfaz. Por eso D0 ensaya el grupo A completo.

## 2. Requerimientos elegidos

| RF | Qué se mostrará | Etapa |
|---|---|---|
| 01 | Registro, inicio y cierre de sesión | D0 |
| 02 | Cambio entre área de cliente y de trabajador | D0 |
| 06, 07, 29 | Perfil, documentos y horarios del trabajador | D0 |
| 08 | Estado del perfil y motivo (se ve completo tras D1) | D0 |
| 15 | Segundo pedido de la misma categoría con aviso | D0 |
| 10 | Revisar perfil y aprobar, observar o rechazar con motivo | D1 |
| 47 | Suspender y reactivar un trabajador | D1 |
| 56 | El administrador ve los documentos; un tercero no | D1 |
| 16 | Buscar trabajadores por categoría y zona | D2 |
| 11, 54 | Perfil público y catálogos para visitantes | D2 |
| 09 | Un trabajador no aprobado no aparece ni recibe pedidos | D2 |
| 50 | Listado de pedidos con detalle, línea de tiempo y constancias | D3 |
| 53 | Bitácora de acciones | D3 |
| 52 | Reportes por rango de fechas y descarga CSV | D3 |
| 48, 49 | Alta, edición y desactivación de categorías y zonas | D4 |
| 33 | Avisos, contador y marcar como leído | D5 |
| 13 | Solicitar y resolver un cambio de zona | D6 |
| 44, 45, 46 | Calificar, ver promedio y opiniones | D7 |

## 3. Plan de implementación

Complejidad relativa. Un **bloque** equivale a uno de los bloques de E3 (pantalla, servicio, pruebas y verificación); no son horas.

### D0 — Ensayo y validación de lo construido

| Campo | Detalle |
|---|---|
| RF | 01, 02, 06, 07, 08, 15, 29 (+7) y confirmación de los 28 del grupo A |
| Demo | Registro, alta de trabajador, documentos, envío a revisión, aviso de pedido duplicado, recorrido completo de pedidos y ofertas |
| Endpoints reutilizados | Los 68 ya consumidos |
| Por probar | #1, #7, #23, #25–#28, #32–#34, #43 |
| Por integrar | Ninguno |
| Complejidad | Baja, 1 bloque (más lo que cueste corregir fallos) |
| Dependencias | Entorno aislado de pruebas |
| Pruebas mínimas | Script de integración de perfil, documentos y registro; recorrido en la interfaz con las tres cuentas; corregir solo fallos que rompan la demo |
| Cobertura | 28 → **35 (62,5 %)** |

La desactivación de cuenta (#7) se prueba solo con una cuenta desechable.

### D1 — Verificación de trabajadores (administrador)

| Campo | Detalle |
|---|---|
| RF | 10, 47, 56 (+3). Hace visibles los estados de RF-08 |
| Demo | Bandeja filtrable por estado, detalle, ver y descargar documentos, aprobar, observar, rechazar, suspender y reactivar |
| Endpoints reutilizados | #8, #10 (filtros), #29 (historial que ve el trabajador) |
| Por integrar | #55–#60 |
| Complejidad | Media-alta, 3 bloques (listado y detalle; documentos; decisiones) |
| Dependencias | D0 (que un trabajador pueda enviar su perfil) |
| Pruebas mínimas | Transiciones permitidas y 409, motivo obligatorio, 403 sobre el propio perfil, cliente sin acceso a documentos |
| Cobertura | **38 (67,9 %)** |

#66 (reasignar zona) queda fuera salvo que se necesite.

### D2 — Búsqueda y perfil público

| Campo | Detalle |
|---|---|
| RF | 16, 11, 54, 09 (+4) |
| Demo | El cliente busca, ve resultados o el aviso de «sin resultados», abre un perfil; un visitante abre el perfil sin ver documentos ni contacto |
| Endpoints reutilizados | #8, #10, #52, #53 |
| Por integrar | #114, #106, #107 |
| Complejidad | Media, 2 bloques |
| Dependencias | D1 (para mostrar que solo aparecen los aprobados) |
| Pruebas mínimas | Aprobado aparece y pendiente o suspendido no; perfil inexistente (404); la respuesta no muestra teléfono ni correo |
| Cobertura | **42 (75,0 %)** |

Sin calificaciones habilitadas, el perfil muestra «sin opiniones». No inventar promedios. El perfil público no trae foto.

### D3 — Supervisión, bitácora y reportes — **cruza el 80 %**

| Campo | Detalle |
|---|---|
| RF | 50, 53, 52 (+3) |
| Demo | Pedidos con filtro por estado, detalle con línea de tiempo y constancias; bitácora filtrable de solo lectura; cinco reportes con descarga CSV; tarjetas de acceso en el inicio del administrador |
| Endpoints reutilizados | #68, #100, #112 y componentes `service-timeline`, `receipts-list` |
| Por integrar | #67, #22, #115 |
| Complejidad | Media, 3 bloques |
| Dependencias | D1 (genera acciones para la bitácora) |
| Pruebas mínimas | 403 para no administradores; rango de fechas inválido; reporte vacío; el CSV se descarga |
| Cobertura | **45 (80,4 %)** |

### D4 — Categorías y zonas (margen recomendado)

| Campo | Detalle |
|---|---|
| RF | 48, 49 (+2) |
| Demo | Crear, editar y desactivar; la opción desactivada desaparece al publicar un pedido |
| Endpoints reutilizados | #8, #10 |
| Por integrar | #12, #14, #16–#21 |
| Complejidad | Baja-media, 2 bloques (un componente común para ambos catálogos) |
| Dependencias | Ninguna; puede adelantarse |
| Pruebas mínimas | Nombre duplicado (409), desactivar dos veces, permisos |
| Cobertura | **47 (83,9 %)** |

No hay reactivación: ensayar solo con elementos creados para la demo.

### D5 — Notificaciones

| Campo | Detalle |
|---|---|
| RF | 33 (+1); mejora la demostración de 28 y 34 |
| Demo | Contador en el encabezado, lista, marcar una o todas como leídas |
| Por integrar | #61–#64 |
| Complejidad | Baja-media, 1–2 bloques |
| Dependencias | Ninguna. Sin tiempo real: se actualiza al navegar |
| Pruebas mínimas | Cada rol ve solo las suyas; aviso tras oferta, acuerdo, adicional y cancelación |
| Cobertura | **48 (85,7 %)** |

Aporta mucho a la fluidez de la demo: si hay tiempo, hacerla antes que D4 y D6.

### D6 — Cambio de zona

| Campo | Detalle |
|---|---|
| RF | 13 (+1) |
| Demo | El trabajador solicita o retira; el administrador aprueba o rechaza |
| Por integrar | #35–#40, #65 |
| Complejidad | Media, 2 bloques |
| Dependencias | D1 |
| Pruebas mínimas | Bloqueos (409), rechazo sin motivo, no resolver la propia |
| Cobertura | **49 (87,5 %)** |

### D7 — Calificaciones (solo con decisión escrita)

| Campo | Detalle |
|---|---|
| RF | 44, 45, 46 (+3) |
| Demo | Ambas partes califican una vez; promedio y opiniones en el perfil; el administrador puede ocultar |
| Por integrar | #103–#105, #107–#109 |
| Complejidad | Media, 2 bloques |
| Dependencias | Decidir qué estados permiten calificar (CU-44 y CU-45 se contradicen); D2 |
| Configuración | `REVIEWS_ELIGIBLE_STATUSES` en el arranque del entorno de demo (no es código ni migración, pero requiere tu autorización) |
| Pruebas mínimas | No calificar dos veces ni un trabajo no terminado |
| Cobertura | **52 (92,9 %)** |

El marcado de lenguaje ofensivo (RF-44) quedaría pendiente.

### Extras sin incremento de cobertura

Solo si sobra tiempo: agenda básica del trabajador (#110, #111), gestión de cuentas por el administrador (#4, #5, #7) y diferencias de pago (#102). La agenda y las cuentas aparecen en tu lista de prioridades, pero no cierran ningún RF nuevo.

## 4. Cobertura estimada

| Etapa | Nuevos | Demostrables | Cobertura | Bloques acumulados |
|---|---|---|---|---|
| Hoy | — | 28 | 50,0 % | 0 |
| D0 | +7 | 35 | 62,5 % | 1 |
| D1 | +3 | 38 | 67,9 % | 4 |
| D2 | +4 | 42 | 75,0 % | 6 |
| **D3** | +3 | **45** | **80,4 %** | **9** |
| D4 | +2 | 47 | 83,9 % | 11 |
| D5 | +1 | 48 | 85,7 % | 12–13 |
| D6 | +1 | 49 | 87,5 % | 14–15 |
| D7 | +3 | 52 | 92,9 % | 16–17 |

Son estimaciones: cada etapa se cuenta solo cuando su flujo se comprueba.

## 5. Ruta crítica

```
D0 ──► D1 ──► D2 ──► D3   = 45 (80,4 %)
        │
        └───────────────► D4, D5 (margen, independientes de D2 y D3)
```

- **Mínimo:** D0–D3, unos 9 bloques.
- **Recomendado:** D0–D4, unos 11 bloques (47).
- **Alternativa si D3 se atasca:** D0, D1, D2, D4 y D5 también suman 45, con unos 9–10 bloques.
- **Corte:** si falta tiempo, no empezar D6 ni D7; reservar al menos un bloque para ensayar la demo.
- **Riesgo principal:** un fallo en D0 en un requerimiento «demostrable hoy». Cada uno que caiga exige otro de reemplazo.
- **Reserva:** RF-35 (mostrar un pedido «Vencido» preparado con fechas modificadas, autorizado solo en el esquema temporal). No se cuenta porque no se puede republicar.

### Reglas de ejecución en cada etapa

- Directamente en `main`, sin ramas ni push. Commits solo cuando los autorices.
- Sin modificar backend ni migraciones; nunca contra `public`.
- Antes de cerrar: `npm run build`, `npm test -- --watch=false`, `npm run lint`, integración en el esquema aislado y recorrido en la interfaz (incluido 360 px y axe).
- Corregir pendientes antiguos solo si rompen la demo.

## 6. Pendiente para después de la defensa

### Criterios abiertos de requerimientos que se mostrarán (declararlos)

| RF | Falta |
|---|---|
| 01 | Cierre de sesión en el servidor |
| 11, 54 | Foto y horarios en el perfil público; opiniones sin D7 |
| 18 | Aviso a quienes ofertaron al editar |
| 20 | Estado «Sin acuerdo» |
| 23 | Vigencia y rondas configurables |
| 27 | Contraoferta del adicional |
| 28 | Demostrar el cierre automático a los 7 días |
| 31 | Extensión de la duración |
| 33 | Aviso a quien pierde una oferta |
| 34 | Regla del anticipo al cancelar |
| 36 | Tolerancia y efecto en la calificación |
| 38 | Pedir más información a las partes |
| 39 | Advertencia al no poder iniciar sin anticipo |
| 41 | Subir un comprobante |
| 42 | Estado «conciliado» |
| 47 | Búsqueda por nombre y trabajo en curso |
| 50 | Filtros por categoría, zona y fecha |
| 51 | Vista inicial de pendientes y urgentes |
| 53 | Acciones que el backend no registra |

### No se incluyen

- RF-04, RF-05, RF-12 y RF-35; RF-13 y RF-44 a RF-46 si no se llega a D6 y D7.
- RNF: rendimiento, Firefox y Edge, lector de pantalla, prueba de uso con personas y revisión formal de seguridad, trazabilidad y modelo de datos.
- Deuda conocida: mensaje de pago perdido si falla la recarga, formulario de pago visible a un suspendido, textos del backend con errores o en inglés, `.gitattributes`.

## 7. Guion de demostración (unos 18 minutos, con D0–D4)

**Preparación (antes de la defensa).**

1. Backend de pruebas: `node iniciar-backend.mjs` en `entorno-pruebas`; nunca el backend normal ni `public`. Frontend: `npm start`.
2. `node sembrar-demo.mjs` crea los pedidos `[DEMO]` de respaldo: con visita, terminado para conformidad, terminado para reclamo, y acordados para cancelar y para inasistencia.
3. Una pestaña por rol (la sesión es por pestaña): visitante, cliente, trabajador aprobado, trabajador nuevo y administrador. La sesión dura 1 hora.
4. Tener a mano dos fotografías y un PDF.
5. Usar horarios distintos en cada ensayo (RF-30). Como máximo 20 registros por hora.
6. Las tareas programadas están apagadas: no habrá vencimientos ni cierres automáticos.

| # | Min | Rol | Dónde | Acción y qué se ve | RF |
|---|---|---|---|---|---|
| 1 | 1 | Visitante | Inicio, Cómo funciona, Categorías | Categorías y zonas; sin datos privados | 54 |
| 2 | 3 | Trabajador nuevo | Registrarse → Quiero ofrecer mis servicios → Mi perfil | Registrarse con teléfono, crear perfil y horarios, subir documento y enviar: «Pendiente» y sin pedidos | 01, 03, 06, 07, 29 |
| 3 | 3 | Administrador y trabajador | Verificación de trabajadores | Consultar el documento, observar con motivo, el trabajador reemplaza y reenvía, aprobar, suspender y reactivar | 08, 10, 47, 56 |
| 4 | 1 | Cliente | Buscar trabajadores | Elegir categoría y zona y abrir un perfil; solo aparecen aprobados (buscar Carpintería: el perfil pendiente de prueba no sale) | 09, 11, 16 |
| 5 | 2 | Cliente | Publicar pedido | Publicar con foto; al repetirlo aparece el aviso | 14, 15 |
| 6 | 2 | Trabajador | Cambiar de área → Pedidos disponibles | Pedido de su zona sin dirección; ofertar | 02, 17, 19, 22, 24, 31 |
| 7 | 1 | Ambos | Oferta | Contraoferta, historial y aceptación; aparecen dirección y contacto | 20, 21, 23, 30, 55 |
| 8 | 2 | Ambos | Pedido `[DEMO] Visita y adicional` | Anticipo, visita y su cobro; proponer el adicional y aceptarlo (el pedido pasa a «En ejecución»); marcar como terminado | 25, 26, 39, 32 |
| 9 | 1 | Cliente | Pedido `[DEMO] Conformidad` | Declarar el saldo, constancias, aviso de pago directo y dar conformidad | 28, 40, 41, 42, 43 |
| 10 | 1 | Cliente y administrador | Pedido `[DEMO] Reclamo` → Reclamos | Reclamo con foto, revisión y resolución | 37, 38, 51 |
| 11 | 1 | Administrador | Pedidos, Bitácora, Reportes, Categorías, Zonas | Detalle con historial, quién hizo qué, reporte y CSV, crear una categoría y desactivarla | 48, 49, 50, 52, 53 |

**Caminos alternos:** rechazar el adicional (27), editar y cancelar un pedido sin acuerdo (18), `[DEMO] Cancelacion de trabajo` (34) e `[DEMO] Inasistencia` (36). El orden anticipo → visita es obligatorio: la visita se registra después de confirmar el anticipo.

**Cuidado:** desactivar una categoría o zona no se puede deshacer; usar solo las creadas durante la demo.

## 8. Decisiones

- **Resueltas el 25/11/2026:** commits locales por etapa autorizados, demo en el entorno aislado y alcance D0–D4.
- **Abiertas:** que el equipo confirme la regla de conteo (parcial demostrable = 1, sobre 56) y, si se quiere D7, qué estados permiten calificar.

## 9. Registro de ejecución (D0–D4)

Autorizado el 25/11/2026: directamente en `main`, commits locales, sin push, sin cambios en backend ni migraciones y solo en el esquema aislado `e1_frontend_pruebas`.

Dos métricas separadas, ambas sobre 56:

- **Demostrable provisional:** pantalla, acción, respuesta, persistencia y permisos comprobados contra el backend.
- **Formal completa:** definición estricta de la auditoría (frontend cubre los criterios, backend verificado, integración real y pruebas unitarias).

| Punto de control | Demostrable | Formal completa |
|---|---|---|
| Inicio | 28 sin ensayar (50,0 %) | 15 (26,8 %) |
| D0 | **35 (62,5 %)** | **20 (35,7 %)** |
| D1 | **38 (67,9 %)** | **23 (41,1 %)** |
| D2 | **42 (75,0 %)** | **25 (44,6 %)** |
| D3 | **45 (80,4 %)** | **26 (46,4 %)** |
| D4 | **47 (83,9 %)** | **28 (50,0 %)** |

### D0 — Validación de lo construido

- **Completados (demostrables):** los 28 del grupo A, ensayados de nuevo en la interfaz, y 01, 02, 06, 07, 08, 15 y 29.
- **Fallidos:** ninguno.
- **Defecto corregido:** el aviso «El pedido fue cancelado» se arrastraba al detalle de otro pedido.
- **Evidencia en pantalla:** registro, cierre e inicio de sesión; cambio de área; perfil, especialidades, horarios, documento (subida y descarga) y envío a revisión; aviso de pedido repetido; publicar, editar y cancelar; oferta, dos contraofertas, rechazo y aceptación; cruce de horario (409 visible); anticipo, saldo y constancias; visita, cobro, adicional y su rechazo; inicio, finalización, conformidad, cancelación, inasistencia, reclamo con foto y resolución.
- **Integración:** `integracion-d0.mjs` 15/15 (cubre los 11 endpoints que faltaban: #1, #7, #23, #25–#28, #32–#34, #43) y los 14 scripts anteriores sin fallos.
- **Calidad:** 893 pruebas unitarias, build (323,85 kB iniciales), ESLint y Prettier correctos; `public` intacta.
- **Formal completa:** se suman 02, 06, 07, 15 y 29. RF-08 se cierra cuando se vean «Observado» y «Rechazado» (D1).
- **Pendientes anotados:** el reemplazo de documentos se comprueba en pantalla en D1; textos del backend en el historial («Oferta de el trabajador»); el 409 de horario muestra el identificador completo del otro pedido; sin aviso explícito del anticipo en «Acordado» sin visita (RF-39).

### D1 — Verificación de trabajadores

- **Completados (demostrables):** RF-10, RF-47 y RF-56.
- **Fallidos:** ninguno.
- **Pantallas:** `/admin/trabajadores` (bandeja con filtros de estado, zona y especialidad; muestra primero los pendientes) y su detalle (cuenta, datos, horarios, documentos, historial y decisiones).
- **Endpoints integrados:** #55–#60.
- **Evidencia en pantalla:** observar con motivo obligatorio, motivo visible para el trabajador, reemplazo de documento y reenvío, rechazar, aprobar, suspender (pierde el acceso a pedidos) y reactivar; documento visto y descargado por el administrador; un cliente recibe «Acceso no permitido».
- **Integración:** `integracion-d1.mjs` 11/11 y regresión (E1, E2, E3.1–E3.5, D0) sin fallos.
- **Calidad:** 908 pruebas unitarias, build, ESLint y Prettier correctos; sin desbordamiento ni infracciones de axe a 360 y 375 px, también con el diálogo abierto; `public` intacta.
- **Formal completa:** se suman 08, 10 y 56. RF-47 queda parcial por el backend (sin búsqueda por nombre ni definición para el trabajo en curso).
- **Pendientes:** reasignar la zona de un perfil (#66) no se implementó.

### D2 — Búsqueda y perfil público

- **Completados (demostrables):** RF-09, RF-11, RF-16 y RF-54.
- **Fallidos:** ninguno.
- **Pantallas:** `/cliente/buscar-trabajadores` y su perfil; `/trabajadores/:id` para visitantes; zonas en `/categorias`; enlace al perfil desde la oferta recibida.
- **Endpoints integrados:** #114, #106 y #107.
- **Evidencia en pantalla:** filtros obligatorios, resultados con horarios, mensaje sin resultados, perfil desde la búsqueda y desde una oferta, perfil como visitante sin contacto, «Perfil no disponible» y redirección al inicio de sesión.
- **Integración:** `integracion-d2.mjs` 8/8 (pendiente y suspendido no aparecen; el perfil público no expone correo ni teléfono).
- **Calidad:** 917 pruebas unitarias, build, ESLint y Prettier correctos; sin desbordamiento ni infracciones de axe a 360 y 375 px; `public` intacta.
- **Formal completa:** se suman 09 y 16.
- **Pendientes:** el perfil público no tiene foto ni horarios y las calificaciones siguen deshabilitadas (RF-11); un visitante solo llega a un perfil por su enlace, porque no hay listado público (RF-54). #107 está integrado, pero solo se ve con más de cinco opiniones.

### D3 — Supervisión, bitácora y reportes

- **Completados (demostrables):** RF-50, RF-52 y RF-53.
- **Fallidos:** ninguno.
- **Pantallas:** `/admin/pedidos` y su detalle (datos mínimos, constancias y línea de tiempo), `/admin/bitacora` y `/admin/reportes`; accesos en el inicio y enlace desde el reclamo.
- **Endpoints integrados:** #67, #22 y #115; se reutilizan #68, #100 y #112.
- **Evidencia en pantalla:** filtro por estado, detalle de un pedido cerrado, bitácora filtrada con enlace al perfil, reporte con totales, descarga del CSV, aviso sin datos y validación de fechas.
- **Integración:** `integracion-d3.mjs` 12/12 (incluye 403 para un cliente y que la bitácora no admite cambios).
- **Calidad:** 932 pruebas unitarias, build, ESLint y Prettier correctos; sin desbordamiento ni infracciones de axe a 360 y 375 px; `public` intacta. axe detectó dos regiones con el mismo nombre en reportes y la tabla no cabía a 375 px: ambos corregidos.
- **Formal completa:** se suma 52.
- **Pendientes:** los pedidos solo se filtran por estado (RF-50) y el backend no registra algunas acciones (RF-53). La bitácora responde vacía, sin error, si la fecha final es el día anterior a la inicial y se envían sin hora (la pantalla lo impide antes).
- **Entorno:** `integracion-e32.mjs` falló una vez por un cruce de horarios al azar (RF-30); ahora usa horarios únicos.

### D4 — Categorías y zonas

- **Completados (demostrables):** RF-48 y RF-49.
- **Fallidos:** ninguno.
- **Pantallas:** `/admin/categorias` y `/admin/zonas` (un componente común): alta, edición, filtro de activos e inactivos y desactivación con confirmación.
- **Endpoints integrados:** #12, #14 y #16–#21.
- **Evidencia en pantalla:** alta, nombre repetido, edición, opción visible al publicar un pedido, desactivación que la retira y entradas en la bitácora.
- **Integración:** `integracion-d4.mjs` 12/12 (solo crea y desactiva elementos propios).
- **Calidad:** 940 pruebas unitarias, build, ESLint y Prettier correctos; sin desbordamiento ni infracciones de axe a 360 y 375 px, también con el diálogo y la edición abiertos; `public` intacta.
- **Formal completa:** se suman 48 y 49.
- **Pendientes:** no existe la reactivación; #13 y #15 (consulta de un elemento) no se usan.

## 10. Informe final D0–D4

### 10.1 Resultado

| Métrica | Antes | Ahora |
|---|---|---|
| Cobertura demostrable provisional | 28 sin ensayar (50,0 %) | **47 de 56 (83,9 %)** |
| Cobertura formal completa | 15 de 56 (26,8 %) | **28 de 56 (50,0 %)** |
| Endpoints consumidos por pantallas | 68 de 115 | **88 de 115 (76,5 %)** |
| Pruebas unitarias | 892 | **940** (82 archivos) |

Los 47 incluyen 19 requerimientos parciales con su flujo principal demostrable. No hubo requerimientos que fallaran.

**No demostrables (9):** RF-04, RF-05, RF-12, RF-13, RF-33, RF-35, RF-44, RF-45 y RF-46.

### 10.2 RF demostrables y evidencia

«Pantalla» es lo ejecutado en la interfaz contra el backend el 25/11/2026. «Script» es el archivo `integracion-<nombre>.mjs` que pasó en la regresión final. «Formal» usa la definición estricta de la auditoría.

| ID | Requerimiento | Pantalla | Script | Formal |
|---|---|---|---|---|
| RF-01 | Registro, inicio y cierre de sesión | Registro, cierre e inicio de sesión | d0 | No |
| RF-02 | Cambio de rol de trabajador a cliente | Cambio de área cliente/trabajador | d0 | Sí |
| RF-03 | Funciones de trabajador solo con perfil aprobado | Pendiente y suspendido sin pedidos | d0, d1 | Sí |
| RF-06 | Datos del perfil del trabajador | Perfil, datos y especialidades | d0 | Sí |
| RF-07 | Documentación de respaldo | Subida, descarga y reemplazo | d0, d1 | Sí |
| RF-08 | Estados del perfil | Observado, rechazado, aprobado y suspendido | d0, d1 | Sí |
| RF-09 | Ocultar perfiles no aprobados | Búsqueda sin no aprobados; perfil no disponible | d2 | Sí |
| RF-10 | Revisión y decisión sobre el perfil | Aprobar, observar y rechazar con motivo | d1 | Sí |
| RF-11 | Perfil público | Perfil público desde la búsqueda, la oferta y sin sesión | d2 | No |
| RF-14 | Creación de un pedido | Publicar pedido con foto | e1 | Sí |
| RF-15 | Varios pedidos activos | Aviso de pedido repetido | d0 | Sí |
| RF-16 | Búsqueda de trabajadores | Búsqueda y aviso sin resultados | d2 | Sí |
| RF-17 | Visibilidad del pedido | Pedidos disponibles | e1, e2 | Sí |
| RF-18 | Edición y cancelación sin acuerdo | Editar y cancelar | e1 | No |
| RF-19 | Envío de una oferta | Enviar oferta | e2 | Sí |
| RF-20 | Aceptar, rechazar o contraofertar | Dos contraofertas, rechazo y aceptación | e2 | No |
| RF-21 | Historial de la negociación | Historial de la negociación | e2 | Sí |
| RF-22 | Condiciones claras antes de aceptar | Condiciones antes de aceptar | e2 | Sí |
| RF-23 | Vigencia y máximo de rondas | Ronda 3 de 3 y vencimiento | e2 | No |
| RF-24 | Cotización por fotos o visita | Oferta por fotos y trabajo con visita | e2, e33a | Sí |
| RF-25 | Cobro de la visita | Visita y confirmación del cobro | e33a | Sí |
| RF-26 | Presupuesto adicional | Proponer y aceptar un adicional | e33b | Sí |
| RF-27 | Rechazo del adicional | Rechazar el adicional | e33b | No |
| RF-28 | Terminado y conformidad | Iniciar, terminar y dar conformidad | e33c | No |
| RF-29 | Días y horarios de atención | Guardar horarios | d0 | Sí |
| RF-30 | Prevención de cruces | Aviso de cruce al aceptar | e2 | Sí |
| RF-31 | Duración estimada | Duración en oferta y trabajo | e2 | No |
| RF-32 | Línea de tiempo | Línea de tiempo | e31 | Sí |
| RF-34 | Cancelación del trabajo | Cancelar un trabajo acordado | e34a | No |
| RF-36 | Trabajador que no llega | Reportar inasistencia | e34b | No |
| RF-37 | Presentación de un reclamo | Reclamo con fotografía | e35a, e35b | Sí |
| RF-38 | Atención del reclamo | Revisar y resolver | e35c, e35d | No |
| RF-39 | Registro del anticipo | Confirmar el anticipo | e32 | No |
| RF-40 | Confirmación del pago final | Saldo declarado por ambas partes | e32 | Sí |
| RF-41 | Constancias | Constancias | e32 | No |
| RF-42 | Confirmación «Ya pagué» | Declaraciones de ambas partes comparadas | e32 | No |
| RF-43 | Aviso de pago directo | Aviso de pago directo | e32 | Sí |
| RF-47 | Gestión y suspensión de trabajadores | Suspender y reactivar | d1 | No |
| RF-48 | Categorías | Alta, edición y desactivación de categoría | d4 | Sí |
| RF-49 | Zonas | Alta y desactivación de zona | d4 | Sí |
| RF-50 | Supervisión de pedidos | Listado, filtro, detalle, constancias e historial | d3 | No |
| RF-51 | Panel de reclamos | Panel de reclamos filtrado | e35c | No |
| RF-52 | Reportes | Reporte en pantalla y CSV | d3 | Sí |
| RF-53 | Bitácora | Bitácora filtrada | d3 | No |
| RF-54 | Información pública para visitantes | Inicio, categorías, zonas y perfil sin sesión | d2 | No |
| RF-55 | Dirección exacta | Dirección solo para el asignado | e1, e2 | Sí |
| RF-56 | Documentación restringida | El administrador ve documentos; el cliente recibe acceso denegado | d0, d1 | Sí |

### 10.3 Endpoints integrados en D1–D4 (20)

| Etapa | Endpoints |
|---|---|
| D1 | #55–#60 |
| D2 | #106, #107, #114 |
| D3 | #22, #67, #115 |
| D4 | #12, #14, #16–#21 |

- D0 probó por primera vez #1, #7, #23, #25–#28, #32–#34 y #43.
- De los 88 consumidos, 87 respondieron correctamente en los scripts de la regresión final; #81 (foto del pedido asignado) solo se comprueba desde la pantalla.
- #107 está integrado, pero el botón que lo usa no aparece mientras las calificaciones estén deshabilitadas.
- **Sin consumir (27):** #4, #5, #9, #11, #13, #15, #35–#41, #61–#66, #102–#105 y #108–#111.

### 10.4 Pruebas y calidad

| Comprobación | Resultado final |
|---|---|
| Pruebas unitarias | 940 de 940 |
| Build de producción | Correcto; carga inicial 325,14 kB (91,91 kB transferidos) |
| ESLint | Correcto |
| Prettier (`--end-of-line auto`) | Correcto en `src/` |
| Integración real | 19 scripts: 229 comprobaciones numeradas y la prueba de paginación |
| Esquema `public` | Intacto en cada punto de control (30 tablas, 35 filas) |
| Backend y migraciones | Sin cambios (`2918395`) |

**Incidencias resueltas:** aviso de cancelación arrastrado entre pedidos; en reportes, dos regiones con el mismo nombre y una tabla que no cabía a 375 px; `integracion-e32.mjs` chocaba con horarios al azar. En la regresión final, D0, D1 y D2 recibieron 429 por el límite de 20 registros por hora: se reinició el backend de pruebas y los tres pasaron.

### 10.5 Responsive y accesibilidad

- Recorrido final: 44 rutas (7 públicas, 13 de cliente, 10 de trabajador y 14 de administración, con los accesos denegados) a **360 y 375 px**: sin desbordamiento horizontal, sin infracciones de axe, sin alertas de error y con todas las peticiones en 200.
- Durante las etapas también se revisaron con axe diálogos y formularios abiertos de D1 y D4.
- **No verificado:** Firefox, Edge, lector de pantalla, navegación completa por teclado, rendimiento y prueba de uso con personas.

### 10.6 Commits locales (sin push)

| Commit | Contenido |
|---|---|
| `9a3dbf5` | Auditoría y plan |
| `862ca87` | Corrección del aviso en el detalle del pedido |
| `4fcbd6b` | Registro de D0 |
| `8fdfa53` | D1 |
| `5ad98e8` | D2 |
| `dbf69ed` | D3 |
| `a1e11dc` | D4 |

Después de estos va el commit de este informe. No se crearon ramas.

### 10.7 Pendiente para después de la defensa

- **Requerimientos:** D5 (RF-33), D6 (RF-13) y D7 (RF-44 a RF-46, con decisión); RF-04 (requiere backend), RF-05 y RF-12 (decisiones) y RF-35.
- **Criterios abiertos de los 19 parciales:** los de la sección 6, salvo lo cerrado en D1 y D4.
- **Pantallas:** reasignar la zona de un perfil (#66), gestión de cuentas, agenda y diferencias de pago.
- **Textos y detalles del backend:** «Oferta de el trabajador» en el historial; el 409 de horario muestra el identificador completo de otro pedido; la bitácora no avisa de un rango invertido de días consecutivos.
- **Frontend conocido:** sin aviso explícito del anticipo en «Acordado» sin visita; mensaje de pago perdido si falla la recarga; formulario de pago visible a un suspendido; sin `.gitattributes`.
- **RNF:** seguridad, privacidad y trazabilidad con revisión formal; Firefox, Edge, lector de pantalla y rendimiento.
- **Datos de la demo:** el esquema aislado acumula cientos de pedidos de prueba y catálogos inactivos que se ven en las pantallas del administrador. Preparar un esquema limpio requiere tu autorización.

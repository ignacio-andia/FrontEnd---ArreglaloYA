# Plan de cierre funcional — 80 % demostrable

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

## 7. Guion de demostración (unos 16 minutos, con D0–D5)

**Preparación.** Entorno aislado, nunca `public`. Una pestaña por rol (la sesión es por pestaña). Cuentas de cliente, trabajador aprobado, trabajador nuevo y administrador; fotos y un documento listos; un pedido ya terminado y otro acordado como respaldo. Usar horarios distintos en cada ensayo para no chocar con RF-30. Revisar que la sesión (1 h) no haya vencido. Las tareas programadas están apagadas. Comprobar en el ensayo si la visita y el anticipo pueden mostrarse en un mismo pedido o necesitan dos.

| # | Min | Rol | Acción y qué se ve | RF |
|---|---|---|---|---|
| 1 | 1 | Visitante | Inicio, cómo funciona, categorías | 54 |
| 2 | 2 | Trabajador nuevo | Registrarse, crear perfil, horarios, subir documento, enviar a revisión: «Pendiente» y sin pedidos | 01, 06, 07, 08, 29, 03, 09 |
| 3 | 2 | Administrador | Ver documento, observar con motivo, aprobar tras la corrección; suspender y reactivar a otro | 10, 47, 56 |
| 4 | 1 | Cliente | Buscar trabajadores y abrir el perfil aprobado | 16, 11 |
| 5 | 2 | Cliente | Publicar pedido con fotos y ver el aviso de duplicado | 14, 15 |
| 6 | 2 | Trabajador | Cambiar de área, ver el pedido de su zona sin dirección exacta, ofertar | 02, 17, 19, 22, 24, 31 |
| 7 | 1 | Ambos | Aviso, contraoferta, historial y aceptación; aparecen dirección y contacto | 33, 20, 21, 23, 30, 55 |
| 8 | 2 | Ambos | Anticipo, visita, presupuesto adicional, inicio, finalización, conformidad y línea de tiempo | 25, 26, 28, 32, 39 |
| 9 | 1 | Ambos | Pago final, declaraciones y constancias, aviso de pago directo | 40, 41, 42, 43 |
| 10 | 1 | Cliente y admin | Reclamo con foto, panel y resolución | 37, 38, 51 |
| 11 | 1 | Administrador | Pedidos, bitácora, reporte con CSV y una categoría nueva | 50, 53, 52, 48, 49 |

**Caminos alternos preparados** (si preguntan): rechazo del adicional (27), editar y cancelar un pedido sin acuerdo (18), cancelar un trabajo acordado (34), reportar inasistencia (36).

## 8. Decisiones que necesito antes de empezar

1. ¿El equipo acepta la regla de conteo (parcial demostrable = 1, denominador 56)?
2. ¿Autorizas commits locales por bloque validado?
3. ¿La defensa se hará con el entorno aislado de pruebas? Si no, hay que preparar otra base sin tocar `public`.
4. Solo para D7: ¿qué estados permiten calificar?

## 9. Registro de ejecución (D0–D4)

Autorizado el 25/11/2026: directamente en `main`, commits locales, sin push, sin cambios en backend ni migraciones y solo en el esquema aislado `e1_frontend_pruebas`.

Dos métricas separadas, ambas sobre 56:

- **Demostrable provisional:** pantalla, acción, respuesta, persistencia y permisos comprobados contra el backend.
- **Formal completa:** definición estricta de la auditoría (frontend cubre los criterios, backend verificado, integración real y pruebas unitarias).

| Punto de control | Demostrable | Formal completa |
|---|---|---|
| Inicio | 28 sin ensayar (50,0 %) | 15 (26,8 %) |
| D0 | **35 (62,5 %)** | **20 (35,7 %)** |

### D0 — Validación de lo construido

- **Completados (demostrables):** los 28 del grupo A, ensayados de nuevo en la interfaz, y 01, 02, 06, 07, 08, 15 y 29.
- **Fallidos:** ninguno.
- **Defecto corregido:** el aviso «El pedido fue cancelado» se arrastraba al detalle de otro pedido.
- **Evidencia en pantalla:** registro, cierre e inicio de sesión; cambio de área; perfil, especialidades, horarios, documento (subida y descarga) y envío a revisión; aviso de pedido repetido; publicar, editar y cancelar; oferta, dos contraofertas, rechazo y aceptación; cruce de horario (409 visible); anticipo, saldo y constancias; visita, cobro, adicional y su rechazo; inicio, finalización, conformidad, cancelación, inasistencia, reclamo con foto y resolución.
- **Integración:** `integracion-d0.mjs` 15/15 (cubre los 11 endpoints que faltaban: #1, #7, #23, #25–#28, #32–#34, #43) y los 14 scripts anteriores sin fallos.
- **Calidad:** 893 pruebas unitarias, build (323,85 kB iniciales), ESLint y Prettier correctos; `public` intacta.
- **Formal completa:** se suman 02, 06, 07, 15 y 29. RF-08 se cierra cuando se vean «Observado» y «Rechazado» (D1).
- **Pendientes anotados:** el reemplazo de documentos se comprueba en pantalla en D1; textos del backend en el historial («Oferta de el trabajador»); el 409 de horario muestra el identificador completo del otro pedido; sin aviso explícito del anticipo en «Acordado» sin visita (RF-39).

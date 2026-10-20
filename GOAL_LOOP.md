# GOAL_LOOP.md — Ciclo persistente de objetivos

> Documenta el trabajo. La continuación autónoma real la gestiona el goal del harness.
> Aplicar: **PLANIFICAR → IMPLEMENTAR → PROBAR → EVALUAR → CORREGIR → DOCUMENTAR → CONTINUAR**.

## OBJETIVO PRINCIPAL

Construir y validar TECLA LIVE hasta cumplir los criterios de aceptación de la sección 24 del prompt maestro: dashboard funcional, YouTube real, TECLA AI por texto y voz, integraciones multimedia, seguridad, persistencia, Docker y documentación verificable.

## FASE ACTUAL

**Fase 7 — Producción**, completada en el alcance verificable. Las claves reales ya se probaron; quedan pendientes la vinculación de Spotify, el micrófono físico, Easypanel y el hardware Tesla.

## OBJETIVO ACTIVO

**Objetivo 0.1:** dejar el proyecto con archivos de control reales, dependencias instaladas y una base Next.js que compile con TypeScript estricto.

Estado: **Completado.**

**Objetivo 7.1:** entregar una aplicación completa, probada localmente, con Docker, migraciones, documentación y bloqueos declarados.

Estado: **Completado en alcance verificable.**

### CRITERIOS DE FINALIZACIÓN

- [x] Repositorio inspeccionado y trabajo previo preservado.
- [x] `AGENTS.md`, `DEEPSEEK.md`, `memori.md`, `GOAL_LOOP.md`, `PLAN.md`, `TASKS.md` con información real.
- [x] Objetivo persistente del harness configurado (24 rondas).
- [x] `npm install` sin errores.
- [x] Prisma schema válido y migración inicial aplicada a PostgreSQL 16.
- [x] `npm run typecheck` sin errores.
- [x] `npm run lint` sin errores (6 avisos documentados).
- [x] `npm run build` de producción correcto.
- [x] 45 pruebas unitarias aprobadas.
- [x] 26 pruebas E2E aprobadas.
- [x] Docker build correcto, contenedor no root, health check y conexión a base de datos.
- [x] Docker Compose levanta PostgreSQL, aplica migraciones y arranca la app.
- [x] Registro/login/sync verificados contra PostgreSQL.
- [x] Function calling verificado con mock local y con DeepSeek real (tool de clima + acción de UI).
- [x] Integraciones con claves reales verificadas: YouTube, DeepSeek, Deepgram y ElevenLabs; Spotify con credenciales/redirect validados.
- [x] Prueba real de YouTube, DeepSeek, Deepgram y ElevenLabs (2026-10-20).
- [ ] Vincular la cuenta de Spotify y probar reproducción (requiere autorización del usuario y dispositivo activo).
- [ ] Verificación en navegador Tesla (requiere hardware).
- [ ] Despliegue en Easypanel y tecla.live (requiere infraestructura).

## INTEGRACIÓN REAL CON DEEPSEEK HARNESS

Comprobado en esta sesión con el gestor de plugins del harness:

- `@deepseek-ai/dsh-goal` — **activo**.
- `@deepseek-ai/dsh-goal-round-driver` — **activo**.
- Objetivo persistente creado: `goal-20cc1836-fe0e-4b8d-b656-b6422b03bf91`.
- Máximo inicial: **24 rondas autónomas**.
- Este archivo no activa el driver por sí mismo; documenta el ciclo y la evidencia.

## ITERACIÓN ACTUAL

| Iteración | Acción | Resultado | Estado |
| --- | --- | --- | --- |
| 1 | Inspeccionar workspace, Git, Node, npm y Docker | Directorio vacío; Node 26.3.0, npm 11.18.0, Docker 29.3.1 | Completada |
| 2 | Verificar versiones estables | Next 16.4.2, React 19.3.1, TS 5.9.3, Tailwind 4.3.3, Prisma 6.19.3 | Completada |
| 3 | Crear objetivo del harness y archivos de control | goal activo y documentación viva | Completada |
| 4 | Scaffold y base técnica | typecheck y build inicial verdes | Completada |
| 5 | Fase 1: shell, dashboard, clima, búsqueda, temas | UI responsive y estados reales | Completada |
| 6 | Fase 2: YouTube, reproductor, biblioteca | IFrame oficial, historial, cola, mini player | Completada (proveedor bloqueado) |
| 7 | Fase 3: DeepSeek, herramientas, panel | 21 tools, action bridge, límites, mock e2e | Completada (proveedor bloqueado) |
| 8 | Fase 4: Deepgram/ElevenLabs y voz | push-to-talk, TTS, interrupciones, fallback | Completada (proveedores bloqueados) |
| 9 | Fase 5: radio, podcasts, IPTV, Twitch, Maps, Spotify | implementaciones reales y límites | Completada (Spotify/streams bloqueados) |
| 10 | Fase 6: cuentas PostgreSQL, sync, memoria, ajustes | auth y sync verificados | Completada |
| 11 | Fase 7: pruebas, Docker, Compose, documentación | unit 45, e2e 26, imagen y compose OK | Completada |
| 12 | Pulido de iconos de marca y transparencia de Waze | glyphs reales, atribución y mapa en vivo oficial | Completada |
| 13 | Prueba de claves reales | YouTube, DeepSeek, ElevenLabs, Deepgram y credenciales Spotify verificados | Completada con pendientes de hardware/autorización |
| 14 | Fix de producción `/watch` | iframe fuera de React, filtro de no embebibles, selección oficial y E2E verdes | Completada local; pendiente redespliegue |

## ÚLTIMA ACCIÓN

Prueba real de claves con build de producción en Docker: YouTube (búsqueda/tendencias/reproductor), DeepSeek (texto, herramienta de clima y acción de interfaz), ElevenLabs (MP3), Deepgram (transcripción del MP3), Spotify (credenciales y redirect). Evidencia en `docs/INTEGRATION-TEST.md`.

## RESULTADO

- `npm run typecheck`: OK.
- `npm run lint`: 0 errores, 6 avisos `set-state-in-effect` en hidratación/tiempo.
- `npm run build`: OK, 39 rutas.
- `npm run test:run`: 45/45.
- `npx playwright test`: 26/26.
- PostgreSQL: migración `20261020022821_init`, tablas creadas, registro/login/sync y uso de IA registrados.
- Docker: imagen final construida con build arg `NEXT_PUBLIC_APP_URL=https://tecla.live`; contenedor no root, health check healthy y home HTTP 200.
- Compose: DB + migrate + app; migración aplicada y health 200.
- Mock DeepSeek: tool server `get_weather` real + acción cliente `set_theme` + continuación + ledger (`AIUsageEvent`).

## BLOQUEADORES

- Spotify: las credenciales y el redirect son válidos, pero falta que el usuario autorice su cuenta para probar reproducción; además requiere Premium y dispositivo activo.
- Micrófono físico: no se pudo automatizar con el dispositivo simulado de Chromium (getUserMedia queda pendiente); la captura real debe probarse en un navegador con micrófono.
- Navegador Tesla: sin hardware; autoplay, micrófono, fullscreen y HLS requieren prueba física.
- Easypanel/tecla.live: sin acceso; despliegue no verificado.
- Waze: alertas de huecos/cámaras sin API pública de consumidor; no se simulan.
- Twitch: sin credenciales de API no hay búsqueda interna de directorio; embed oficial y búsqueda externa implementados.
- Transcripción parcial: limitación de diseño del flujo REST actual.

## SIGUIENTE ACCIÓN

Configurar credenciales en un entorno seguro y ejecutar la matriz de verificación de proveedores y Tesla descrita en `docs/EASYPANEL.md` y `README.md`. Solo entonces marcar las tareas externas como completadas.

## ESTADO

**Completado en alcance verificable** · pruebas locales, Docker e integraciones principales reales verdes · quedan Spotify link, micrófono físico, Tesla y Easypanel.

## REGLAS DEL CICLO

1. Leer el objetivo activo antes de actuar.
2. Seleccionar una tarea pequeña y verificable.
3. Ejecutarla y comprobarla con un comando o verificación reproducible.
4. Registrar el resultado real; no inferir éxito.
5. Si falla, diagnosticar y corregir; máximo tres intentos equivalentes antes de cambiar de estrategia o declarar bloqueo.
6. Actualizar `TASKS.md`, `memori.md` y este archivo.
7. No repetir acciones destructivas. No desplegar ni gastar crédito extraordinario sin autorización.
8. Detenerse al completar el objetivo o al existir un bloqueo real.

## BITÁCORA

- **2026-10-19 21:00** — Inicio. Workspace vacío; se inicializa Git.
- **2026-10-19 21:03** — Objetivo persistente creado; paquetes de goal activos.
- **2026-10-19 21:05** — Archivos de control y scaffold.
- **2026-10-19 21:10** — Primer build verde de la base.
- **2026-10-19 21:20** — Dashboard, YouTube, TECLA AI, voz, ajustes y páginas multimedia implementadas.
- **2026-10-19 21:28** — PostgreSQL 16, migración y auth/sync verificados.
- **2026-10-19 21:32** — 45 pruebas unitarias verdes.
- **2026-10-19 21:36** — 26 pruebas E2E verdes; se corrigió la hidratación usando `localhost` y no `127.0.0.1` en Playwright.
- **2026-10-19 21:40** — Docker build, contenedor, migración y Compose verificados.
- **2026-10-19 21:45** — Mock local de DeepSeek validó function calling, continuación y ledger; documentación de cierre.
- **2026-10-20 05:10** — Iconos de marca reales con atribución; Waze documentado con enlace al mapa en vivo. Avisos de huecos/cámaras no son accesibles por API pública y no se simulan.
- **2026-10-20 08:25** — Claves reales cargadas y verificadas: YouTube, DeepSeek + tool + acción, ElevenLabs, Deepgram y credenciales Spotify. Micrófono físico y link de Spotify quedan pendientes de prueba interactiva.
- **2026-10-20 10:05** — Corregido crash de `/watch` en producción: YouTube reemplazaba el nodo de React y lanzaba `removeChild`. Se añadió filtro de no embebibles, preferencia por canal oficial y 26 E2E verdes. Pendiente redeploy y TLS válido.

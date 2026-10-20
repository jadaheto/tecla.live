# GOAL_LOOP.md — Ciclo persistente de objetivos

> Documenta el trabajo. La continuación autónoma real la gestiona el goal del harness.
> Aplicar: **PLANIFICAR → IMPLEMENTAR → PROBAR → EVALUAR → CORREGIR → DOCUMENTAR → CONTINUAR**.

## OBJETIVO PRINCIPAL

Construir y validar TECLA LIVE hasta cumplir los criterios de aceptación de la sección 24 del prompt maestro: dashboard funcional, YouTube real, TECLA AI por texto y voz, integraciones multimedia, seguridad, persistencia, Docker y documentación verificable.

## FASE ACTUAL

**Fase 7 — Producción**, completada en el alcance verificable. Las verificaciones que dependen de credenciales externas, Easypanel o hardware Tesla quedan declaradas como bloqueos.

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
- [x] Function calling verificado con mock local de DeepSeek.
- [x] Integraciones sin credenciales documentadas como bloqueadas.
- [ ] Prueba real de YouTube, DeepSeek, Deepgram, ElevenLabs y Spotify (requiere claves).
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

## ÚLTIMA ACCIÓN

Pulido de iconos de marca reales (YouTube, Spotify, Waze, Google Maps, Netflix, Disney+, Podcasts y Twitch) con atribución, y transparencia de Waze: tarjeta de avisos, enlace al mapa en vivo oficial y regla antiinvención en TECLA AI. Se ejecutaron typecheck, lint, 45 tests unitarios, 26 E2E y build; se reconstruirá la imagen Docker final.

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

- `YOUTUBE_API_KEY`, `DEEPSEEK_API_KEY`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`/`VOICE_ID`, `SPOTIFY_CLIENT_ID`/`SECRET`: no disponibles. Los adaptadores están listos; la prueba real no se puede hacer ni declarar.
- Easypanel/tecla.live: sin acceso; despliegue no verificado.
- Navegador Tesla: sin hardware; autoplay, micrófono, fullscreen y HLS requieren prueba física.
- Twitch: sin credenciales de API no hay búsqueda interna de directorio; embed oficial y búsqueda externa implementados.
- Transcripción parcial: limitación de diseño del flujo REST actual.

## SIGUIENTE ACCIÓN

Configurar credenciales en un entorno seguro y ejecutar la matriz de verificación de proveedores y Tesla descrita en `docs/EASYPANEL.md` y `README.md`. Solo entonces marcar las tareas externas como completadas.

## ESTADO

**Completado en alcance verificable** · pruebas locales y Docker verdes · integraciones externas bloqueadas por credenciales/infraestructura.

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

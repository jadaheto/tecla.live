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
- [x] 51 pruebas unitarias aprobadas.
- [x] 28 pruebas E2E aprobadas.
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
| 11 | Fase 7: pruebas, Docker, Compose, documentación | unit 49, e2e 27, imagen y compose OK | Completada |
| 12 | Pulido de iconos de marca y transparencia de Waze | glyphs reales, atribución y mapa en vivo oficial | Completada |
| 13 | Prueba de claves reales | YouTube, DeepSeek, ElevenLabs, Deepgram y credenciales Spotify verificados | Completada con pendientes de hardware/autorización |
| 14 | Fix de producción `/watch` | iframe fuera de React, filtro de no embebibles, selección oficial y E2E verdes | Completada local; pendiente redespliegue |
| 15 | Fix del flujo de micrófono | estado `transcribing` liberado; STT→chat→TTS verificado con audio inyectado | Completada local; pendiente hardware/redespliegue |
| 16 | TECLA DRIVE | canvas original, audio, GPS opcional, modo demo y 51/28 pruebas | Completada local |
| 19 | TECLA DRIVE v3 para el Tesla | arranque de un toque, HUD autoocultable, panel como capa, modo demo aparte, GPS robusto con rumbo, escena automática, estacionado, modo rendimiento, AudioWorklet con paridad probada, `drive_control`; typecheck, lint, 61 unitarias, build Docker y E2E | Completada local; contenedor :3000 reemplazado |
| 18 | Jarvis + Cyberpunk 2077 + Spotify real | persona configurable en el prompt, estilo visual con tipografía Rajdhani, `search_spotify`/`play_spotify`, Web Playback SDK, Drive junto a Spotify; typecheck, lint, 57 unitarias, build Docker y E2E (sin cuenta) verdes | Completada local; contenedor :3000 reemplazado |
| 17 | TECLA DRIVE v2 (prototipo HTML del usuario portado a TS) | carretera pseudo-3D, 10 escenas, 26 motores, transmisión, REV/0–100/paseo/GPS, estudio; typecheck, lint, 57 unitarias, build Docker y E2E de Drive verdes | Completada local; pendiente redespliegue |
| 20 | Fase 9: arranque tipo nave, orbe reactivo, Pantalla ambiente, telemetría GPS y control remoto por QR | typecheck, lint (0 errores), 111 unitarias, Playwright (arranque ×4 estilos, ambiente, remoto auto↔celular, Drive con GPS simulado), build de producción | Completada local; push a GitHub → Easypanel |

## ÚLTIMA ACCIÓN

**2026-10-20 16:05** — TECLA DRIVE v2: se reemplazó la experiencia anterior por el simulador que el usuario envió como prototipo HTML, portado a la arquitectura del proyecto (TypeScript estricto, módulos puros probados, store persistido, Web Audio con síntesis física por tipo de motor, renderer de carretera pseudo-3D con 10 escenas y sprites). Los nombres de motores se reescribieron por arquitectura, sin marcas ni modelos comerciales. Se dejó fuera, a propósito, la carga de grabaciones por URL/archivo del prototipo (no aplica al navegador del Tesla). Verificación: `tsc` OK, `eslint` 0 errores (6 avisos previos), 57/57 unitarias, `docker build` (Node 22, `next build`) OK, contenedor en :3100 con `/api/health` 200 y `/drive` 200, 2/2 E2E de Drive verdes, revisión visual en Chrome (motor encendido, paseo automático, relámpagos, panel de sonidos y escenas).

## RESULTADO

- `npm run typecheck`: OK.
- `npm run lint`: 0 errores, 6 avisos `set-state-in-effect` en hidratación/tiempo.
- `npm run build`: OK, 40 rutas.
- `npm run test:run`: 51/51.
- `npx playwright test`: 28/28.
- PostgreSQL: migración `20261020022821_init`, tablas creadas, registro/login/sync y uso de IA registrados.
- Docker: imagen final construida con build arg `NEXT_PUBLIC_APP_URL=https://tecla.live`; contenedor no root, health check healthy y home HTTP 200.
- Compose: DB + migrate + app; migración aplicada y health 200.
- Mock DeepSeek: tool server `get_weather` real + acción cliente `set_theme` + continuación + ledger (`AIUsageEvent`).
- TECLA DRIVE: `AudioContext` en estado `running` y 5 osciladores verificados para el preset V8; escenas y controles probados en desktop y móvil.
- TECLA DRIVE v2 (2026-10-20): `tsc` OK; `eslint` 0 errores; `vitest` 57/57 (catálogo sin marcas, transmisión, modos, pedales, síntesis por tipo de motor, GPS); imagen `tecla-live:drive2` construida con `next build` en Node 22; E2E de Drive 2/2 contra la imagen (escena, motor, paseo automático, encender/apagar, GPS simulado). Resultado de la suite E2E completa contra la imagen sin base de datos: ver bitácora.

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
- **2026-10-19 21:32** — 44 pruebas unitarias verdes (la suite creció a 49 con TECLA DRIVE).
- **2026-10-19 21:36** — 26 pruebas E2E verdes; se corrigió la hidratación usando `localhost` y no `127.0.0.1` en Playwright.
- **2026-10-19 21:40** — Docker build, contenedor, migración y Compose verificados.
- **2026-10-19 21:45** — Mock local de DeepSeek validó function calling, continuación y ledger; documentación de cierre.
- **2026-10-20 05:10** — Iconos de marca reales con atribución; Waze documentado con enlace al mapa en vivo. Avisos de huecos/cámaras no son accesibles por API pública y no se simulan.
- **2026-10-20 08:25** — Claves reales cargadas y verificadas: YouTube, DeepSeek + tool + acción, ElevenLabs, Deepgram y credenciales Spotify. Micrófono físico y link de Spotify quedan pendientes de prueba interactiva.
- **2026-10-20 10:05** — Corregido crash de `/watch` en producción: YouTube reemplazaba el nodo de React y lanzaba `removeChild`. Se añadió filtro de no embebibles y preferencia por canal oficial. En ese momento eran 26 E2E; la suite creció a 27 con TECLA DRIVE. Pendiente redeploy y TLS válido.
- **2026-10-20 10:15** — Corregido flujo de micrófono: Deepgram transcribía, pero `send()` era rechazado por el estado `transcribing`; ahora se libera y la transcripción se envía. Verificado STT→chat→TTS con audio inyectado en Chromium.
- **2026-10-20 13:30** — Añadido TECLA DRIVE: experiencia original en `/drive` con tres escenas Canvas, gauge, paseo 0–100 y cuatro sonidos sintetizados. AudioContext verificado; 49 unitarias y 27 E2E. Sin assets de EV Sound FX.
- **2026-10-20 13:52** — TECLA DRIVE con GPS opcional: `watchPosition`, velocidad real o derivada de posiciones, permisos, caída segura a Demo y privacidad local. Prueba E2E con GPS simulado; 51 unitarias y 28 E2E. La captura con GPS físico sigue pendiente.
- **2026-10-20 16:05** — TECLA DRIVE v2: prototipo HTML del usuario portado a TypeScript (carretera pseudo-3D, 10 escenas, 26 motores sin marcas, transmisión, REV, 0–100, paseo, GPS, estudio, favoritos). `tsc` OK, `eslint` 0 errores, 57/57 unitarias, imagen Docker `tecla-live:drive2` construida (Node 22), E2E contra la imagen en `:3100`: 27/28 (la de cuenta falla solo porque ese contenedor no tiene PostgreSQL; las 2 de Drive pasan). Revisión visual en Chrome sin errores de consola. Pendiente: redespliegue, `AudioWorklet`, Tesla físico.
- **2026-10-25** — Efectos de clima en Inicio (canvas por clima real, interruptor en Ajustes). 88 pruebas unitarias. Lección: no mezclar `npm run build` y `next dev` en el mismo `.next` (bucle de recargas por HMR); limpiar `.next` antes de `next dev`.
- **2026-10-23** — Cortinilla de cambio de estilo, inicio compacto (solo «Continuar viendo» bajo accesos rápidos) y preset Flat-6 GT3. Build de producción y Docker verificados localmente; el fallo de Easypanel no se reprodujo (pendiente su log).
- **2026-10-23** — Estilo «Roadster» a partir de capturas del usuario (cabina de caza). Verificación: typecheck, lint, Vitest y revisión visual.
- **2026-10-21** — Estilo «El auto fantástico» (KITT) + «Oye TECLA» robusto para el navegador del Tesla. Verificación: typecheck, lint, Vitest y revisión visual en el navegador.
- **2026-10-21** — Reproducción de fondo: radio y Spotify web ya no se cortan al navegar (audio global + árbitro + barra flotante). typecheck 0 errores, 77 pruebas unitarias, 28 E2E (nuevo `background-playback.spec.ts` con stream simulado) e imagen Docker desplegada en :3000. El Chrome automatizado se congela al reproducir audio/video, por eso la verificación de audio es con Playwright.
- **2026-10-21** — Despliegue en Easypanel en amarillo: causa `PORT=80` vs health check fijo en 3000; corregido el Dockerfile para seguir `PORT` y documentado.
- **2026-10-21** — Voces de ElevenLabs movidas a `ELEVENLABS_VOICES` (entorno), endpoint público `/api/ai/voices/public` y selector abierto a todos los usuarios sin cuenta de ElevenLabs.
- **2026-10-21** — Radio por voz con autoplay y resultado real; aclarado que «Oye TECLA» no gasta tokens (reconocimiento del navegador) y retirado el texto de depuración.
- **2026-10-21** — Identidad del asistente (nombre personalizable, bloque de identidad) y voces curadas de ElevenLabs (Valeria por defecto; Alejandro, Alberto, Andrea, Valentina; Brian, George, Daniel; Sarah, Alice, Matilda).
- **2026-10-21** — «Oye TECLA» corregido (reinicio tras segundo plano, frase más tolerante, prueba jsdom) y despedidas por voz con cierre del HUD.
- **2026-10-21 (madrugada)** — Fases C y D de la hoja de ruta: streaming SSE + voz por frases, «Oye TECLA», saludo de arranque, memoria ampliada; escenas Navidad/Ciudad lluviosa/Ciudad de día, clima dibujado, sonido de cambio, modo silencioso, detalle automático por fps. El usuario descartó las fases B y E. Se explicó cómo teslaplay.net reproduce en marcha (decodificación en JavaScript sobre canvas, sin `<video>`) y se mantuvo el rechazo a implementarlo.
- **2026-10-20 21:20** — Orbe fluido tipo asistente de voz con niveles reales de micrófono y TTS.
- **2026-10-20 20:50** — TECLA AI solo voz: HUD flotante sin teclado que escucha al abrir y se cierra al responder, botón de voz en Drive, `play_youtube` con resultado real y sin advertencia de autoplay genérica.
- **2026-10-20 17:45** — Manos libres en TECLA AI: micrófono al abrir el panel, envío automático al callar, consentimiento guiado y ajuste. Se rechazó eludir la restricción de video en marcha del Tesla (seguridad del vehículo).
- **2026-10-20 17:20** — YouTube «se oye pero no se ve al manejar»: diagnosticado como restricción del navegador del Tesla (video bloqueado fuera de Park, audio continúa); no se elude. Añadido Modo conducción en `/watch` (carátula, título, progreso, controles grandes, «Ver video»), preferencia `watchAudioMode`, `set_display_mode` acepta `audio`, prompt explica la restricción. Documentado en `docs/TESLA-VIDEO.md`. Verificación: `tsc` OK, lint 0 errores, unitarias verdes, E2E del reproductor extendida (ver resultado en la línea siguiente si se añadió).
- **2026-10-20 16:45** — TECLA DRIVE v3 para el Tesla: arranque de un toque (audio + GPS + pantalla completa + wake lock + modo cine), HUD que se oculta a los 6 s, panel de sonidos y escenas como capa con icono discreto, paseo/0–100/pedales solo en modo demo, REV solo detenido, GPS con retención de velocidad, calidad y curvatura por rumbo, escena automática por hora y clima, estacionado con volumen bajo, modo rendimiento automático en Tesla, `AudioWorklet` con respaldo y prueba de paridad, `drive_control` para TECLA AI y Drive como reproductor atenuable. `tsc` OK, lint 0 errores, 61/61 unitarias, imagen `tecla-live:drive3`, E2E 27/27 (sin cuenta) contra :3000. Se corrigió un desajuste de hidratación (hora local del servidor vs navegador) detectado en Chrome y se reconstruyó. Contenedor :3000 reemplazado; `tecla-live-prod-jarvis1-backup` queda detenido como respaldo. Bloqueado: GPS/DRM/rendimiento en el Tesla físico y TLS en tecla.live; pendiente: streaming de TECLA AI.
- **2026-10-20 16:20** — Jarvis + Cyberpunk 2077 + Spotify real: persona `jarvis` por defecto (prompt, saludo del panel, selector en Ajustes), estilo visual `cyberpunk` (tokens neón, Rajdhani, scanlines, `set_visual_style`), Spotify con `search_spotify`/`play_spotify`, rutas de búsqueda/dispositivos/token, Web Playback SDK en `/music`, alcance `streaming`; TECLA Drive junto a Spotify. `tsc` OK, lint 0 errores, 57/57 unitarias, imagen `tecla-live:jarvis1` construida; contenedor `tecla-live-prod` en :3000 reemplazado (el anterior quedó detenido como `tecla-live-prod-gps5-backup`); E2E contra :3000 sin la prueba de cuenta: 27/27 tras aceptar el saludo Jarvis. Verificado en Chrome: estilo Cyberpunk, Drive junto a Spotify y saludo «A sus órdenes, señor». Pendiente: vincular Spotify Premium (requiere volver a autorizar por el alcance nuevo) para probar reproducción en pantalla; DRM en el navegador del Tesla sin verificar.

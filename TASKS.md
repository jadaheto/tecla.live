# TASKS.md — Tareas de TECLA LIVE

> `[x]` = completada **y comprobada**. `[ ]` = pendiente o bloqueada.
> Evidencia completa en `GOAL_LOOP.md` y `memori.md`.

## FASE 0 — BASE DEL AGENTE

- [x] Inspeccionar el repositorio y confirmar que no había trabajo previo (`ls`, `git status`, `find`).
- [x] Inicializar repositorio Git local.
- [x] Crear `AGENTS.md` con reglas, prioridades, seguridad y definición de terminado.
- [x] Crear `DEEPSEEK.md` con arquitectura, convenciones, integraciones y despliegue.
- [x] Crear `memori.md` con decisiones y estado real.
- [x] Crear `GOAL_LOOP.md` con objetivo activo y bitácora.
- [x] Crear `PLAN.md` con fases, riesgos, pruebas y aceptación.
- [x] Crear `TASKS.md`.
- [x] Crear objetivo persistente del harness (24 rondas) y verificar `dsh-goal` / `dsh-goal-round-driver`.
- [x] Fijar versiones y crear `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`.
- [x] Crear `.env.example` sin secretos y `.gitignore`.
- [x] Diseñar el esquema Prisma inicial (14 modelos).
- [x] Generar `.env` local con secretos aleatorios (ignorado por Git).
- [x] Completar `npm install` sin errores.
- [x] Ejecutar `prisma validate` y `prisma generate`.
- [x] Ejecutar `npm run typecheck` con la base inicial.
- [x] Ejecutar el primer `npm run build`.

## FASE 1 — FUNDACIÓN

- [x] Tokens de diseño claro/oscuro, tipografía Geist, radios, glass y fondos ambientales.
- [x] Providers: TanStack Query, tema automático, toasts y atajos.
- [x] Header: logo, reloj/fecha, clima, búsqueda, TECLA AI, tema, fullscreen y ajustes.
- [x] Accesos rápidos táctiles con YouTube, Spotify, Waze, Maps, Netflix, Disney+, Radio, IPTV, Podcasts, Twitch y TECLA AI.
- [x] Estados de carga, error, vacío y «no configurado» reutilizables.
- [x] Iconos de marca reales (YouTube, Spotify, Waze, Maps, Netflix, Disney+, Podcasts, Twitch) con atribución y proporciones correctas.
- [x] TECLA DRIVE original: ruta `/drive`, escenas Canvas, gauge, paseo 0–100, cuatro sonidos sintetizados, controles táctiles y enlace desde el catálogo. Sin assets de EV Sound FX.
- [x] Layout responsive para 1920×1080, tablet y móvil, sin hover obligatorio.
- [x] Modos normal, cine y kiosco; tema claro/oscuro/automático configurable.
- [x] Búsqueda universal con atajos y debounce; resultados de apps y YouTube.
- [x] Atajos de teclado y accesibilidad (foco, ARIA, Escape, diálogo de ayuda).
- [x] Fullscreen con detección de soporte y fallback.
- [x] Saludo contextual y hero editorial cinematográfico.
- [x] Widget de clima real con Open-Meteo para Sincelejo.
- [x] Carruseles: continuar viendo, tendencias, recomendados, favoritos, listas, música y apps.
- [x] Persistencia del orden de carruseles desde Ajustes.
- [x] Dockerfile multi-stage, standalone, usuario no root y health endpoint.
- [x] `docker-compose.yml` con PostgreSQL, migración y app.
- [x] Pruebas unitarias iniciales de utilidades, tema y stores.
- [x] Playwright: dashboard, tema, búsqueda, navegación y móvil.

## FASE 2 — YOUTUBE

- [x] Adaptador YouTube Data API v3 con timeout, errores, caché TTL y detección de cuota.
- [x] `/api/youtube/search` validado con Zod y límites de tasa.
- [x] Tendencias Colombia (`regionCode=CO`).
- [x] Metadatos de video y canal mediante `videos.list`.
- [x] Página `/youtube` con búsqueda real, categorías y estados.
- [x] Reproductor IFrame oficial (sin extracción de streams).
- [x] Página `/watch/[videoId]` con cola, metadatos y acciones.
- [x] Historial y «continuar viendo» con progreso.
- [x] Favoritos, listas propias y cola persistidos.
- [x] Modo cine y minirreproductor global.
- [x] Manejo de cuota agotada/clave ausente.
- [x] Tests de validación, URLs y E2E de estado no configurado.
- [x] Verificación contra YouTube Data API real: búsqueda, tendencias y metadatos (2026-10-20).
- [ ] Verificación de reproducción/autoplay en navegador Tesla (pendiente de hardware).

## FASE 3 — TECLA AI TEXTO

- [x] Esquemas Zod de 21 herramientas y listas blancas de apps.
- [x] Registro de herramientas con esquema JSON para DeepSeek y separación servidor/cliente.
- [x] Cliente DeepSeek server-side con timeout, reintento controlado y uso de tokens.
- [x] Orquestador con máximo de pasos, tool results reales y `toolExchange` de continuación.
- [x] System prompt en español con reglas de honestidad, seguridad y antiinyección.
- [x] Action bridge del navegador: play, pausa, tema, modo, fullscreen, favoritos, apps, navegación, memoria.
- [x] `/api/ai/chat` con rate limit invitado/autenticado y presupuesto.
- [x] Panel flotante y página `/ai` con historial, estados y sugerencias.
- [x] Fallback textual si DeepSeek no está configurado.
- [x] Memoria de preferencias con consentimiento, consulta y borrado.
- [x] Tests de tools, validación, permisos, ciclo de function calling y presupuesto.
- [x] Function calling de extremo a extremo con mock local de DeepSeek (tool servidor + tool cliente + continuación).
- [x] Verificación contra DeepSeek API real: respuesta de texto, herramienta `get_weather` y acción `set_display_mode` vía UI (2026-10-20).
- [x] Modelo configurado `deepseek-flash` respondió correctamente con una clave real; precios pendientes de revisar en el panel de DeepSeek.

## FASE 4 — TECLA AI VOZ

- [x] Captura push-to-talk con permiso explícito y liberación de micrófono.
- [x] `/api/ai/stt` con Deepgram, límite de tamaño/duración, rate limit y borrado de audio.
- [x] `/api/ai/tts` con ElevenLabs streaming, límite de caracteres, voces autorizadas y cancelación.
- [x] Modo conversación opcional con auto-escucha al terminar la voz.
- [x] Estados visuales: inactivo, escuchando, transcribiendo, pensando, ejecutando, hablando y error.
- [x] Interrupción de voz, parada de audio, revocación de URL y nueva solicitud.
- [x] Pausa/restauración de reproductores controlados durante la voz.
- [x] Fallback textual cuando micrófono o APIs no están disponibles.
- [x] Tests de límites, schemas y E2E de estados/fallback.
- [x] Verificación con Deepgram real: transcripción del MP3 de ElevenLabs, confianza 0.996, 3.84 s (2026-10-20).
- [x] Verificación con ElevenLabs real: MP3 128 kbps generado y reproducido por la UI (2026-10-20).
- [ ] Transcripción parcial en streaming (mejora futura; no implementada).
- [ ] Prueba de micrófono/autoplay en Tesla.

## FASE 5 — MULTIMEDIA Y NAVEGACIÓN

- [x] Spotify OAuth, state, cifrado AES-256-GCM de tokens, refresh, now-playing y controles remotos.
- [x] `/api/spotify/*` con auth de sesión activa, rate limit y errores Premium/dispositivo.
- [x] Página `/music` con estado de conexión, controles, volumen y desconexión.
- [x] Waze: búsqueda, recientes, favoritos y deep links validados.
- [x] Google Maps: búsqueda, rutas y favoritos.
- [x] Radio Browser: catálogo, búsqueda, favoritos, HTML5 audio y volumen.
- [x] Podcasts: iTunes Search, avance reproducible, velocidad, historial y enlace al episodio completo.
- [x] IPTV: importación M3U/M3U8 por archivo/texto, validación, categorías, favoritos y HLS con hls.js.
- [x] Twitch: embed oficial con parent válido, canales guardados y apertura externa.
- [x] Netflix y Disney+ como accesos externos.
- [x] Tests unitarios de deep links, M3U y validación; E2E de páginas y navegación.
- [x] Credenciales Spotify y redirect validados (client_credentials 200, authorize sin error de redirect).
- [ ] Vincular la cuenta de Spotify y probar reproducción con Premium/dispositivo activo.
- [ ] Verificación de listas IPTV y canales reales autorizados (requiere contenido del usuario).
- [ ] Búsqueda interna de Twitch (requiere credenciales de API; se usa búsqueda externa).
- [ ] Alertas de huecos/cámaras dentro de TECLA LIVE: bloqueadas; Waze no ofrece API pública de consumidor. Se enlaza el mapa en vivo oficial. Ver `docs/WAZE.md`.

## FASE 6 — PERSONALIZACIÓN

- [x] Registro/login/logout con cookie HttpOnly, bcrypt, sesión en PostgreSQL y revocación.
- [x] Prisma migrate + tablas verificadas contra PostgreSQL 16.
- [x] APIs de preferencias, favoritos e historial con aislamiento por usuario.
- [x] Sincronización local↔cuenta (push + retorno unificado) y carga de preferencias desde la nube.
- [x] Memoria de preferencias con consentimiento y borrado local.
- [x] Sugerencias, «Sorpréndeme» basado en datos reales cuando existen (sin inventar).
- [x] Ajustes completos de tema, horario, display, volumen, voz, privacidad y clima.
- [x] Exportación de datos locales y borrado selectivo/total.
- [x] Tests de aislamiento por esquema, auth, sync y E2E de cuenta real.
- [ ] Borrado de cuenta/datos ya sincronizados (no solicitado en criterios, mejora futura).
- [ ] Prueba de sincronización multidispositivo en producción.

## FASE 7 — PRODUCCIÓN

- [x] Suite Vitest: 49 pruebas aprobadas.
- [x] Playwright: 27 pruebas aprobadas (1920×1080 y móvil).
- [x] Auditoría básica de secretos, cabeceras, validación y límites.
- [x] Pruebas de presupuesto/ledger de IA en PostgreSQL.
- [x] Build Docker final con build arg de dominio.
- [x] Contenedor como usuario no root, health check y home 200.
- [x] Compose con PostgreSQL, migración automática y app; health con `database: connected`.
- [x] `Dockerfile.migrate` probado (imagen 751 MB, sin migraciones pendientes).
- [x] Documento Easypanel con pasos verificables.
- [x] README, capturas y limitaciones.
- [x] Prueba real de YouTube, DeepSeek, Deepgram y ElevenLabs; credenciales y redirect de Spotify.
- [ ] Verificación física en Tesla y captura de micrófono real (el simulador de Chromium queda bloqueado en getUserMedia).
- [ ] Emitir certificado TLS válido para tecla.live (Easypanel está sirviendo un autofirmado `CN=Easypanel`).
- [ ] Despliegue real en Easypanel y comprobación de tecla.live.
- [ ] Rate limit distribuido para múltiples réplicas.

## EVIDENCIA DE VERIFICACIÓN (2026-10-19)

- `npm run typecheck`: OK.
- `npm run lint`: 0 errores · 6 avisos documentados.
- `npm run test:run`: 9 archivos, 49/49 (incluye Waze Live Map y navegación).
- `npx playwright test`: 27/27.
- `npm run build`: OK (40 rutas).
- Docker: `tecla-live:final` construida; contenedor no root; `/api/health` OK; home 200.
- Compose: migración `20261020022821_init` aplicada; 15 tablas; health `database: connected`.
- Mock DeepSeek: `get_weather` (servidor, dato real), `set_theme` (cliente), continuación y `AIUsageEvent` verificados.
- Auth real: registro, sesión, `/api/auth/me`, sync y logout contra PostgreSQL.
- Externos libres verificados manualmente: Open-Meteo, geocodificación, Radio Browser e iTunes.
- Prueba real de claves 2026-10-20: YouTube, DeepSeek, ElevenLabs, Deepgram y credenciales Spotify. Detalle en `docs/INTEGRATION-TEST.md`.

## BLOQUEOS EXTERNOS CONOCIDOS

- [x] YouTube, DeepSeek, Deepgram y ElevenLabs verificados con claves reales.
- [x] Spotify: credenciales de cliente y redirect verificados.
- [ ] Spotify: falta vincular cuenta y probar reproducción.
- [ ] Micrófono físico del navegador: no automatizable en este entorno.
- [ ] Acceso a Easypanel y DNS de tecla.live — no disponible; despliegue no verificado.
- [ ] Navegador del Tesla — prueba física pendiente.
- [ ] Credenciales de Twitch — búsqueda interna no implementada; embed oficial disponible.

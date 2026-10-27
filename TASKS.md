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
- [x] TECLA DRIVE original: ruta `/drive`, escenas Canvas, gauge, paseo 0–100, cuatro sonidos sintetizados, controles táctiles, modo GPS opcional (velocidad real) y enlace desde el catálogo. Sin assets de EV Sound FX.
- [x] TECLA DRIVE v2 (2026-10-20): carretera pseudo-3D con curvas, colinas, tráfico y sprites; 10 escenarios; 26 motores sintetizados por arquitectura (sin marcas); transmisión de 7 marchas auto/manual; REV, pedales táctiles, arrancada 0–100, paseo automático y GPS; estudio de sonido; favoritos y unidades persistidos en `tecla-drive-v1`. Evidencia: typecheck, lint (0 errores), 57 unitarias y E2E en imagen Docker (ver `GOAL_LOOP.md`).
- [x] TECLA DRIVE v3 (2026-10-20): arranque de un toque (audio + GPS + pantalla completa + wake lock + modo cine), HUD que se oculta, panel de sonidos y escenas como capa con icono discreto, paseo/0–100/pedales solo en modo demo, REV solo detenido, GPS robusto (retención de velocidad, calidad, curvatura por rumbo), escena automática por hora y clima, estacionado con volumen bajo, modo rendimiento (auto en Tesla), `AudioWorklet` con respaldo y prueba de paridad, herramienta `drive_control` para TECLA AI y atenuación durante la voz.
- [ ] TECLA DRIVE: verificar en el navegador del Tesla que `navigator.geolocation` entrega velocidad y rumbo (requiere hardware y TLS válido en tecla.live).
- [ ] TECLA AI: respuesta en streaming (texto y voz) para bajar la latencia; cambio de protocolo pendiente de diseño.
- [x] Voces públicas por entorno (`ELEVENLABS_VOICES`): selector en Ajustes para cualquier usuario, sin cuenta de ElevenLabs; respaldo en código si la variable falta (2026-10-21).
- [x] Radio por voz con arranque automático y resultado real; «Oye TECLA» sin texto de depuración (2026-10-21).
- [x] Identidad del asistente (nombre personalizable, bloque de identidad en el prompt) y voces curadas de ElevenLabs: predeterminada del `.env`, 4 latinas/colombianas, 3 hombres y 3 mujeres populares (2026-10-21).
- [x] Despedidas por voz: cierre automático del HUD con respuesta local breve; cierre silencioso si la escucha automática no oye nada (2026-10-21).
- [x] Fase C (2026-10-21): streaming SSE de DeepSeek con voz por frases, «Oye TECLA», saludo de arranque, memoria ampliada. Pendiente: elegir voz Jarvis en ElevenLabs (decisión del usuario).
- [x] Fase D (2026-10-21): escenas Navidad, Ciudad lluviosa y Ciudad de día; clima real dibujado; sonido de cambio; modo silencioso; detalle automático por fps. Pendiente: umbrales con el carro real.
- [ ] Fase B no implementada por decisión del usuario (2026-10-21). Fase E descartada por el usuario.
- [ ] Hoja de ruta nueva en `docs/ROADMAP.md` (fases A–F): TLS y redespliegue, conducir escuchando, Jarvis con streaming, Drive, modo pasajero, operación.
- [ ] Certificado TLS válido en tecla.live (bloquea GPS y micrófono en producción; infraestructura).
- [x] Orbe fluido de TECLA AI (`siri-orb.tsx`): reacciona al nivel real del micrófono y de la voz sintetizada; usado en el HUD de voz, el panel y su estado vacío.
- [x] TECLA AI solo voz: HUD flotante sin teclado (`voice-hud.tsx`, `openAssistant`), cierre automático tras responder, botón de voz en Drive; `play_youtube` reporta `playing`/`autoplayBlocked` y el prompt ya no añade la advertencia de autoplay.
- [x] TECLA AI manos libres: `aiAutoListen` (micrófono al abrir el panel), fin de frase por silencio con `AnalyserNode`, consentimiento automático la primera vez, interruptor en Ajustes. Ver `docs/AI-JARVIS.md`.
- [x] YouTube en marcha: diagnosticado como restricción del navegador del Tesla (video bloqueado, audio sigue). Añadido **Modo conducción** (`watchAudioMode`): carátula, título, progreso y controles grandes sobre el reproductor; `set_display_mode` acepta `audio`. No se elude la restricción. Ver `docs/TESLA-VIDEO.md`.
- [x] Acceso rápido de TECLA Drive junto a Spotify (catálogo y lista blanca alineados; test de registro verde).
- [x] Estilo visual Cyberpunk 2077 (`visualStyle`): tokens neón, tipografía Rajdhani, rejilla/scanlines, fuerza tema oscuro; selector en Ajustes y herramienta `set_visual_style` para TECLA AI.
- [x] Persona Jarvis en TECLA AI (`aiPersona`, por defecto `jarvis`): bloque de personalidad en el prompt, saludo de sistema en el panel y selector en Ajustes. Análisis en `docs/AI-JARVIS.md`.
- [x] Spotify: búsqueda de canciones, reproducción por URI, dispositivos, transferencia, token para el reproductor web oficial y herramientas `search_spotify`/`play_spotify`. Alcance `streaming` añadido (requiere volver a vincular).
- [ ] Spotify: prueba real de reproducción en pantalla (requiere vincular cuenta Premium y navegador con DRM; no verificable sin la cuenta del usuario).
- [ ] TECLA DRIVE: probar sonido y rendimiento del canvas en el navegador físico del Tesla.
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
- [x] Efectos de clima en tiempo real sobre Inicio con interruptor en Ajustes (2026-10-25). Pruebas unitarias de presets + capturas con clima simulado.
- [x] Spotify suena en esta pantalla tras recargar: preferencia recordada, reconexión automática y dispositivo asegurado al reproducir; YouTube/radio se pausan al pedir Spotify, también por voz (2026-10-23).
- [x] Cortinilla por estilo visual + pantalla principal compacta + preset Flat-6 GT3 (2026-10-23). teslasound.io descartado (síntesis propietaria de pago, sin descargas).
- [x] Estilo «Roadster» (2026-10-23): cabina de caza en rojo monocromo, rejilla en perspectiva, regla de HUD, retícula de radar y personalidad «piloto». Verificado con typecheck, lint, Vitest y capturas.
- [x] Estilo «El auto fantástico» (2026-10-21): tema KITT (negro, escáner rojo, ámbar, Orbitron/Share Tech Mono), escáner Larson en la cabecera, modulador de voz en el HUD, personalidad y voz de KITT, «Oye KITT». «Oye TECLA» robusto para el Tesla: alternativas, variantes fonéticas, backoff, vigilante y reactivación por toque. Pruebas unitarias nuevas (wake word, persona, saludo, despedida).
- [x] Reproducción de fondo (2026-10-21): la radio y el reproductor web de Spotify viven fuera de las páginas y siguen sonando al cambiar de pantalla (Inicio, Drive, Ajustes…); barra flotante con portada y controles; árbitro de fuentes (al elegir YouTube, podcast, IPTV o la otra fuente se pausa la anterior; cerrar la barra detiene). Pruebas: `tests/unit/playback.test.ts` y E2E `tests/e2e/background-playback.spec.ts` (stream sustituido por WAV local).
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

- [x] Suite Vitest: 51 pruebas aprobadas.
- [x] Playwright: 28 pruebas aprobadas (1920×1080 y móvil).
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
- `npm run test:run`: 9 archivos, 51/51 (incluye Waze Live Map y navegación).
- `npx playwright test`: 28/28.
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

## FASE 9 — EXPERIENCIA FUTURISTA (2026-10-27)

- [x] Secuencia de arranque «tipo nave» (`bootSequence`): chequeo de sistemas con estado real, briefing y textos por estilo; toque abre TECLA AI por voz si el saludo está activo. Evidencia: `tests/unit/boot-steps.test.ts`, capturas en los cuatro estilos.
- [x] Orbe de TECLA AI con contorno y anillo deformados por el nivel real de voz, ondas en los picos y colores Cyberpunk.
- [x] Pantalla ambiente (`ambientIdleMinutes`, cabecera, voz `set_display_mode: ambient`, control remoto): reloj, clima, carátula, controles, partículas del estilo y desplazamiento antiquemado. Evidencia: `tests/unit/ambient-rules.test.ts`, capturas TECLA y KITT.
- [x] Telemetría GPS en Drive: rumbo (con respaldo por dirección entre fixes), altitud, viaje, máx/prom, cronómetro 0–100 con mejor marca; pérdidas momentáneas de señal no fatales. Evidencia: `tests/unit/telemetry.test.ts`, GPS simulado en Playwright.
- [x] Control remoto por QR: salas en memoria con código + token, SSE al auto, página móvil `/remote/[code]`, contrato Zod de órdenes. Evidencia: `tests/unit/remote.test.ts`, prueba E2E auto ↔ celular (volumen, navegación, pantalla ambiente). Ver `docs/REMOTE.md`.
- [ ] Probar en el Tesla: arranque y briefing por voz, rumbo/altitud reales del GPS, QR escaneado desde un celular real.
- [ ] Si tecla.live corre con varias réplicas, mover las salas del control remoto a PostgreSQL/Redis.

## FASE 10 — TESLA FLEET API (2026-10-27)

- [x] Adaptador `src/lib/integrations/tesla.ts`: OAuth (authorization code + refresh), tokens cifrados en `ConnectedAccount` (provider «tesla»), lectura de `vehicle_data` normalizada a métrico, caché de 2 min, auto dormido sin despertar, `wake_up` explícito, registro de socio. Evidencia: `tests/unit/tesla.test.ts`.
- [x] Rutas `/api/tesla/{login,callback,status,vehicle,wake,disconnect,partner}` con sesión obligatoria y límites de tasa.
- [x] UI: tarjeta «Mi Tesla» en Inicio, sección «Mi Tesla» en Ajustes, paso Tesla en el arranque, línea de batería en Pantalla ambiente, herramienta `get_vehicle_status` para TECLA AI.
- [x] Archivos para el dominio registrado (Hostinger): llave pública en `.well-known/appspecific`, `tesla/callback.php` y `.htaccess` (ver `docs/TESLA-FLEET.md`).
- [x] Producción configurada por el usuario (2026-10-27): archivos en sinapsia.co, registro de socio HTTP 200, cuenta vinculada y tarjeta «Mi Tesla» funcionando en tecla.live.
- [x] Modo carga automático (`teslaChargeMode`): Pantalla ambiente con panel de carga al detectar «cargando»; cierre al terminar o arrancar; no se reabre si el usuario la cierra. Estacionado real bloquea la pantalla ambiente por inactividad. Evidencia: `tests/unit/tesla-alerts.test.ts`, Playwright con API simulada.
- [x] Avisos por voz (`teslaVoiceAlerts`, umbral configurable): batería baja, carga iniciada, carga completa, auto sin bloquear; `announce()` solo con síntesis de voz.
- [ ] Probar en el carro: modo carga en un Supercargador y avisos reales (el audio exige un toque previo en la pantalla).
- [ ] Fase 2 (comandos firmados: clima, maletero, límite de carga) requiere el proxy `tesla-http-proxy` y el permiso `vehicle_cmds`.

## FASE 11 — ESTILO DISCOVERY Y AUTO HOLOGRÁFICO (2026-10-27)

- [x] Estilo «discovery» en tipos, tema forzado oscuro, fuentes Michroma y Exo 2, CSS (paneles, fondo, HUD de puente), cortinilla, arranque, clima, orbe, Pantalla ambiente, Ajustes, herramienta `set_visual_style`, control remoto y persona «computadora» (prompt, saludo, despedida, HUD, «computadora» como palabra de activación). Evidencia: identity/weather/boot tests, capturas Discovery (arranque, Inicio, cortinilla, ambiente con carga, Ajustes, TECLA AI).
- [x] Auto holográfico 3D (`holo-car.tsx`) en la tarjeta «Mi Tesla» y en la Pantalla ambiente, con color del estilo, verde al cargar y rojo con batería baja.
- [ ] Decisión del usuario (2026-10-27): la fase 2 de Tesla (comandos al vehículo) no se implementará por riesgo.

## FASE 12 — PANTALLA «MI TESLA» (2026-10-27)

- [x] `/tesla` junto a Drive (cabecera, acceso rápido «Mi Tesla», `open_app`, control remoto): resumen con holograma, batería y carga, clima, carrocería y seguridad, llantas, ubicación y marcha, vehículo y software, cargadores cercanos e historial de carga. Evidencia: `tests/unit/tesla.test.ts` (detalle), captura con API simulada.
- [x] Rutas `/api/tesla/detail`, `/api/tesla/chargers`, `/api/tesla/charging-history` con sesión, caché (2/10/30 min) y límites.
- [ ] Probar con el auto real: `nearby_charging_sites` e historial dependen de la región y de que Tesla devuelva datos para el VIN.

## FASE 13 — ESTACIONES DE CARGA (PLUGSHARE) (2026-10-27)

- [x] Página `/cargadores` con el widget oficial de PlugShare (centro: Tesla → navegador → ciudad; radio 10/25/50 km), acceso rápido «Cargadores», `open_app` «chargers», control remoto, y mapa dentro de Mi Tesla. Evidencia: `tests/unit/plugshare.test.ts`, captura.
- [ ] El usuario debe aceptar los Términos de Uso del widget en developer.plugshare.com/embed (propietario del sitio).
- [ ] Opcional: Open Charge Map como listado propio con clave `OPENCHARGEMAP_API_KEY`.

# memori.md — Memoria persistente de TECLA LIVE

> Memoria del **agente de desarrollo**. No es la memoria de preferencias de TECLA AI en producción.
> No guardar secretos, credenciales ni transcripciones personales.

## IDENTIDAD DEL PROYECTO

**TECLA LIVE** — centro de entretenimiento web premium optimizado para el navegador del Tesla, con copiloto conversacional TECLA AI. Dominio previsto: https://tecla.live. Idioma: español latinoamericano. Zona horaria: America/Bogota. Clima inicial: Sincelejo, Sucre, Colombia.

## OBJETIVO

Construir y validar una aplicación multimedia real: dashboard cinematográfico, YouTube, radio, podcasts, IPTV, Twitch, navegación, Spotify y TECLA AI por texto y voz, con seguridad, límites de costo, persistencia y despliegue Docker/Easypanel.

## STACK

Next.js 16.4.2 (App Router) · React 19.3.1 · TypeScript 5.9.3 estricto · Tailwind CSS 4.3.3 · componentes shadcn-style sobre Radix · Lucide · Motion · Zustand · TanStack Query · Zod · PostgreSQL + Prisma 6.19.3 · sesiones JWT HttpOnly con jose + bcryptjs + verificación de sesión activa en PostgreSQL · Vitest · Playwright · Docker standalone.

## DECISIONES PERMANENTES

1. **Cliente primero para el modo invitado.** Preferencias, favoritos, historial, listas, destinos e IPTV viven en localStorage; PostgreSQL es opcional y se usa para cuentas autenticadas.
2. **Secretos solo en servidor.** DeepSeek, Deepgram, ElevenLabs, YouTube y Spotify se invocan desde route handlers; el navegador nunca recibe claves permanentes.
3. **Puente de acciones tipadas.** El modelo propone herramientas; el servidor valida con Zod y autoriza; el frontend ejecuta acciones de navegador y devuelve el resultado real antes de que la IA anuncie éxito.
4. **Dos agentes separados.** DeepSeek Harness programa el repositorio; TECLA AI solo controla funciones autorizadas de la app y no tiene acceso a código, shell, entorno ni infraestructura.
5. **Sin contenido simulado.** Si falta una API, se muestra «no configurado» con instrucciones; no se inventan videos, emisoras, canciones ni temperaturas.
6. **Privacidad por diseño.** Sin grabación persistente de audio ni transcripciones por defecto. La memoria de preferencias requiere consentimiento y se puede borrar.
7. **Una base de código Next.js.** STT usa subida de audio al backend y TTS streaming por HTTP. No se añadió un WebSocket propio en la v1.
8. **Autenticación propia.** Cookie HttpOnly `SameSite=Lax`, JWT HS256 con `AUTH_SECRET`, hash bcrypt, registro de sesión y verificación de sesión activa/revocada en PostgreSQL para rutas con datos de usuario.
9. **Diseño con tokens.** Identidad propia, sin copiar recursos de Apple; tema claro/oscuro/automático y modos normal/cine/kiosco.
10. **Compatibilidad Tesla basada en capacidades.** Toda función sensible tiene fallback táctil/textual y detección de soporte.
11. **Spotify real, nunca simulado.** OAuth con scopes mínimos, tokens cifrados AES-256-GCM, controles remotos contra la Web API y mensajes claros si falta Premium o dispositivo activo.
12. **YouTube oficial.** IFrame oficial, sin descargar videos ni extraer streams; las listas de TECLA no se presentan como listas de YouTube.
13. **Proveedores externos en la lista de bloqueos.** Sin credenciales no se declara una integración probada; se entrega adaptador, validación, UI de estado y error.
14. **Rutas de integración nunca aceptan URLs arbitrarias del modelo.** Apps, herramientas y deep links tienen listas blancas; M3U no se importa por proxy del servidor.
15. **Docker/Easypanel verificables.** Imagen multi-stage no root, health endpoint, migraciones separadas y build arg `NEXT_PUBLIC_APP_URL`.

## FUNCIONALIDADES IMPLEMENTADAS

> Solo se registra lo comprobado. Detalle de evidencia en `GOAL_LOOP.md` y `TASKS.md`.

- [x] Fase 0 completa: archivos de control, objetivo del harness, scaffold, Prisma, build y typecheck verdes.
- [x] Dashboard cinematográfico responsive (1920×1080, tablet, móvil) con hero editorial, clima real de Sincelejo (Open-Meteo), accesos rápidos, carruseles, estados vacío/error/carga y pie.
- [x] Búsqueda universal (⌘K), atajos (⌘J, ?), tema claro/oscuro/automático con horario, **estilo visual Cyberpunk 2077** (`visualStyle`, fuerza oscuro, tipografía Rajdhani vía `next/font/google`), modos normal/cine/kiosco, fullscreen con fallback, reducción de movimiento.
- [x] TECLA DRIVE v3 (2026-10-20): arranque de un toque, HUD autoocultable, panel como capa, modo demo separado, GPS robusto con rumbo→curvatura, escena automática por hora/clima, estacionado, modo rendimiento, `AudioWorklet` + respaldo con prueba de paridad, `drive_control` y Drive como reproductor atenuable. Detalle en `docs/DRIVE.md`.
- [x] TECLA DRIVE v2 (`/drive`, 2026-10-20): simulador de sonido de motor y paisaje. Carretera pseudo-3D con curvas/colinas/tráfico, 10 escenas con sprites (Halloween, Neón, Cañón, Costa, Alpes, Aurora, Galaxia, Estrellas, Plaid, Portal), 26 motores sintetizados por arquitectura (sin marcas), transmisión de 7 marchas auto/manual, REV, pedales táctiles, arrancada 0–100, paseo automático, GPS opcional, estudio de sonido y favoritos persistidos (`tecla-drive-v1`). Lógica pura en `engine-model.ts` y `engine-synth.ts` con pruebas; audio en `ScriptProcessorNode` (migración a `AudioWorklet` pendiente). Sin samples ni assets de terceros.
- [x] Iconos de marca reales con atribución: YouTube, Spotify, Waze, Google Maps, Netflix, Disney+, Podcasts y Twitch; Radio/IPTV/TECLA AI conservan iconografía propia.
- [x] YouTube: cliente Data API v3 con caché y cuota, búsqueda/tendencias CO, reproductor IFrame oficial, metadatos, historial con progreso, favoritos, listas, cola y minirreproductor. **Verificado con API real el 2026-10-20.** Fix del crash de `/watch` por reconciliación DOM del iframe y filtro de videos no embebibles.
- [x] TECLA AI texto: 24 herramientas Zod (incluye `set_visual_style`, `search_spotify`, `play_spotify`), persona Jarvis configurable (`aiPersona`, por defecto `jarvis`), registro para DeepSeek, orquestación con máximo de pasos y resultados reales, rate limits, presupuesto, ledger de uso, system prompt antiinyección, panel flotante y página `/ai`. **DeepSeek real verificado (texto, tool de clima y action bridge).**
- [x] Function calling de extremo a extremo validado con mock local de DeepSeek: herramienta de clima real, acción de cliente `set_theme`, continuación con `toolExchange` y eventos en `AIUsageEvent`.
- [x] Memoria consentida de preferencias: store local, herramienta `remember_preference`, contexto al modelo, consulta/borrado en Ajustes.
- [x] Voz: STT push-to-talk con subida al backend y Deepgram; TTS ElevenLabs streaming por backend; interrupción, pausa/restauración de media controlada, selector de voces autorizadas y fallback textual. **Deepgram y ElevenLabs reales verificados; captura de micrófono físico pendiente.**
- [x] Radio Browser: búsqueda, top Colombia, HTTPS, reproducción HTML5, favoritos, volumen y control por TECLA AI.
- [x] Podcasts: búsqueda real en iTunes, reproducción del avance público, velocidad, progreso, favoritos y enlace al episodio completo. No se presenta el avance como episodio completo.
- [x] IPTV: parser M3U/M3U8 validado, importación por archivo/texto, categorías, búsqueda, favoritos y reproducción HLS con hls.js.
- [x] Navegación: Waze y Google Maps con deep links oficiales, búsqueda, recientes, favoritos, Casa/Trabajo y sin GPS. Waze incluye tarjeta de avisos con enlace al mapa en vivo; no se simulan huecos/cámaras.
- [x] Twitch: embed oficial con parent dinámico, canales guardados y búsqueda externa. **Sin credenciales de la API de Twitch no hay búsqueda interna de directorio.**
- [x] Netflix y Disney+ como accesos externos oficiales, sin eludir DRM.
- [x] Spotify: OAuth con state (ahora con alcance `streaming`), tokens cifrados, estado, now-playing, play/pausa/siguiente/anterior/volumen, **búsqueda de canciones, reproducción por URI, lista de dispositivos, transferencia, token para el reproductor web oficial (Web Playback SDK) y UI de búsqueda en `/music`**. **Credenciales y redirect validados; la reproducción real en pantalla requiere vincular una cuenta Premium (cuentas ya vinculadas deben volver a autorizar).**
- [x] Cuentas: registro/login/logout, bcrypt, sesiones revocables, `/api/auth/me`, sincronización de favoritos/historial/preferencias y carga de preferencias desde la nube.
- [x] Ajustes completos: apariencia, pantalla, IA/voz, clima, cuenta, orden del dashboard, privacidad, exportación y borrado local.
- [x] Dockerfile multi-stage no root, health check; Dockerfile.migrate; docker-compose con PostgreSQL, migración y app; build e2e de contenedor verificado.
- [x] 51 pruebas unitarias y 28 pruebas E2E (Playwright) aprobadas; lint sin errores.

- [x] Fase 9 (2026-10-27): secuencia de arranque con chequeo real de sistemas, orbe deformado por la voz, Pantalla ambiente (manual, voz, remoto o por inactividad), telemetría GPS en Drive (rumbo, altitud, viaje, 0–100) y control remoto por QR (salas en memoria, SSE, página móvil). 111 unitarias; verificación Playwright incluida la ida y vuelta auto ↔ celular.

## ESTADO ACTUAL

Aplicación completa en su alcance verificable. **Build de producción, typecheck, lint (0 errores/6 avisos), 51 unitarias, 28 E2E, PostgreSQL 16, migración, Docker y Compose verificados localmente.** La app está corriendo desde la imagen Docker final en `http://localhost:3000`, con claves reales inyectadas en runtime. **YouTube, DeepSeek, Deepgram y ElevenLabs fueron probados contra sus proveedores reales (2026-10-20).** Spotify validó credenciales y redirect; falta la autorización de la cuenta. Micrófono físico, Tesla y Easypanel siguen pendientes.

## PROBLEMAS CONOCIDOS

- Spotify: credenciales de cliente y redirect válidos, pero la cuenta no está vinculada; falta probar reproducción con Premium y dispositivo activo.
- El micrófono físico no se pudo automatizar: el dispositivo simulado de Chromium no resuelve `getUserMedia`. La captura debe probarse manualmente en un navegador con micrófono; Deepgram se probó con audio real generado por ElevenLabs.
- Sin acceso a Easypanel ni DNS de tecla.live: despliegue no verificado.
- Sin acceso físico al navegador del Tesla: autoplay, fullscreen, micrófono y embeds requieren prueba real.
- Deepgram se usa en modo grabación→transcripción; no hay transcripción parcial en streaming.
- Podcasts usan el avance público de iTunes; el episodio completo se abre externamente.
- Twitch no tiene búsqueda interna sin credenciales de su API; se usa embed y búsqueda externa.
- Rate limiting en memoria por instancia; no distribuido entre réplicas.
- Las variables `NEXT_PUBLIC_*` se inyectan en build; el dominio público debe pasarse como build arg `NEXT_PUBLIC_APP_URL`.
- Los avisos de lint `react-hooks/set-state-in-effect` (6) son patrones controlados de hidratación/tiempo, no errores.
- La optimización de imágenes de YouTube real y el reproductor se verificaron con datos reales en la build de Docker.
- **Bug de voz corregido:** la transcripción de Deepgram se descartaba porque `send()` se llamaba con el estado `transcribing`; ahora se libera a `idle` antes de enviar. Flujo completo verificado con audio inyectado en el navegador. Ver `docs/BUGFIX-VOICE.md`.
- **Bug de producción corregido:** `YT.Player` reemplazaba un nodo controlado por React y provocaba `removeChild`. Ahora el iframe se monta en un hijo imperativo fuera de React; los videos no embebibles se filtran y la búsqueda prioriza canales oficiales. Ver `docs/BUGFIX-WATCH.md`.
- **TLS de producción:** tecla.live sirve un certificado autofirmado `CN=Easypanel`; hay que emitir Let's Encrypt. No es un bug de la app y no se puede corregir desde el repo.
- En esta máquina, Node 26.3.0 dejó `next dev`/`next build` locales en un estado anómalo (espera larga y `.next` con artefactos irrepetibles). Se limpió `.next` y la verificación se hizo con Node 22 dentro de Docker. Si vuelve a ocurrir, usar Node 22 LTS y no mantener builds concurrentes.
- Deepgram 400 «corrupt or unsupported data» (2026-10-21, resuelto): los fragmentos de MediaRecorder vivían en un ref compartido; al arrancar una grabación justo cuando la anterior se detenía, el último trozo viejo entraba en la nueva y el WebM perdía la cabecera. Ahora cada grabador tiene su propia lista y solo limpia sus propios refs. El VAD usa piso de ruido adaptativo (umbral = max(0,02, piso×2,5)) para que el ruido del carro no alargue la grabación hasta el tope.
- Producción 2026-10-21: `/v1/voices` de ElevenLabs devolvió campos nulos y el validador estricto tiraba `ELEVENLABS_VOICES_INVALID`; ahora `parseVoicesPayload` es tolerante y la ruta `/api/ai/voices` responde igual con las voces curadas. Deepgram 400: la ruta STT ahora registra `providerCode`/`providerMessage`, mime y bytes, y responde 422 `AUDIO_NOT_UNDERSTOOD` reintentable; revisar el log tras el próximo 400 para ver la causa real.
- Clima por estilo (2026-10-27): `weatherFxPalette` colorea lluvia/nieve/niebla/relámpagos según `visualStyle`. `StyleIntro` ya no se repite en cada carga con estilo especial (consulta sessionStorage también en el cambio por rehidratación).
- Clima en Inicio (2026-10-25): `WeatherFx` + `fx-presets.ts`; preferencia `weatherEffects`. Bucle de recargas en dev tras un `npm run build` en la misma carpeta: `rm -rf .next` antes de `next dev`.
- Spotify web (2026-10-23): dispositivo fantasma tras recargar → preferencia `spotifyWebPlayer` + reconexión en `PlaybackProvider` + `ensureSpotifyWebDevice()` al reproducir. En tecla.live/music se comprobó que «Activar reproductor» registra el dispositivo; no se probó reproducir para no interrumpir la música real del usuario.
- Inicio compacto (2026-10-23): `DASHBOARD_SECTIONS` = solo `continue`; la preferencia `dashboardOrder` persistida se filtra a ids válidos (merge), así que usuarios antiguos no rompen. `StyleIntro` usa sessionStorage `tecla-style-intro` para mostrarse una vez por sesión al arrancar. El build de Easypanel falló con exit 1 sin detalle; `npm run build` y `docker build` pasan localmente (posible fallo transitorio al descargar fuentes de Google en build o memoria).
- Estilo `roadster` (2026-10-23): `VisualStyle` añade "roadster" → persona efectiva "piloto". Componentes en `src/components/roadster/`. Las capturas de referencia están en `roadster/` (ignorado por git, no publicar: material de Tesla).
- Estilo `kitt` (2026-10-21): `VisualStyle` = tecla | cyberpunk | kitt. El estilo manda sobre la persona (`effectivePersona`) y sobre la voz (`ELEVENLABS_KITT_VOICE_ID` → primera voz masculina grave curada). Escáner y modulador en `src/components/kitt/`. «Oye TECLA»: la lógica de coincidencia está en `src/features/ai/wake-word.ts` (normalización + variantes + Levenshtein ≤ 1); el listener reinicia con backoff y vigilante. No se puede probar el reconocimiento real en el Chrome automatizado (sin micrófono): se cubre con jsdom.
- Reproducción de fondo (2026-10-21): el `<audio>` de la radio estaba dentro de la página Radio y Spotify se desconectaba al desmontar Música, por eso se cortaban al ir a Inicio o Drive. Ahora `src/features/radio/radio-audio.ts` y `src/features/music/spotify-web-player-bridge.ts` son instancias únicas fuera de React; `src/features/media/playback-sources.ts` es el árbitro (una sola fuente suena; cerrar la barra detiene); `player-bridge.ts` tiene dos niveles (página y fondo) y en Drive prefiere la música de fondo para «pausa». La barra flotante vive en `mini-player.tsx` y `PlaybackProvider` en el shell. El motor de Drive ya no pausa la música al arrancar. Cambiar de emisora aborta el `play()` anterior (AbortError): se ignora, no es un error de usuario. `PLAYWRIGHT_BASE_URL` permite apuntar los E2E a otro puerto.
- Easypanel inyecta `PORT=80` en el contenedor; el `HEALTHCHECK` del Dockerfile apuntaba fijo a 3000 y el servicio quedaba «unhealthy» (amarillo) aunque el log dijera «Ready». Ahora el health check usa `${PORT:-3000}`; verificado localmente con `-e PORT=80` → healthy en 15 s.
- `ELEVENLABS_VOICES` vive en el `.env` local (línea no secreta) y hay que añadirla en Easypanel; al reemplazar el contenedor local se inyecta desde el `.env` porque el env-file se deriva del contenedor anterior.
- Voces ElevenLabs: la cuenta tiene 304 voces (21 premade, 215 de biblioteca, 66 clonadas); la del `.env` es «Valeria - Friendly Woman» (latina). Los IDs curados están en `curated-voices.ts` y se consultaron con la clave desde el contenedor sin exponerla.
- «Oye TECLA»: `webkitSpeechRecognition` solo admite una instancia activa por página (iniciar otra aborta la anterior); en la automatización de Chrome el micrófono no capta el altavoz del Mac, así que la prueba real de la frase se hace con una prueba jsdom (`tests/unit/wake-word.test.tsx`, vitest incluye `.test.tsx`) y en el carro/PC con voz humana.
- Streaming: `createDeepSeekCompletion` acepta `onTextDelta` (SSE de DeepSeek, `stream_options.include_usage`); la ruta de chat responde SSE solo si el cliente envía `Accept: text/event-stream`, así las pruebas y clientes antiguos siguen con JSON. En el cliente, `streamAiChat` + `splitSentences` alimentan una cola de voz por frases (`beginSpeech/enqueueSpeech/finishSpeech` en `use-tecla-ai.ts`).
- TECLA AI solo voz: `useAi.voiceOpen` y `openAssistant()` deciden entre HUD de voz y panel de texto según `aiAutoListen`; `VoiceHud` y `AiPanel` nunca se montan a la vez porque ambos instancian `useTeclaAI` (grabador propio). El aviso de autoplay venía del prompt; ahora el puente espera el estado real del reproductor (`playbackBlocked`).
- TECLA AI manos libres: el panel inicia `getUserMedia` 260 ms después de abrirse (dentro de la activación del toque) y un detector de silencio cierra el `MediaRecorder`; el umbral RMS 0.02 / 1,4 s está pensado para cabina de carro y puede ajustarse en `use-tecla-ai.ts`.
- Análisis de teslaplay.net (2026-10-20): reproduce en marcha porque no usa `<video>`; decodifica en JavaScript y pinta en canvas/WebGL, técnica documentada públicamente como rodeo al Drive Mode. Rechazado implementarlo incluso con consentimiento; la hoja de ruta legítima está en `docs/ROADMAP.md`.
- Pedido del usuario de «quitar la restricción de video en marcha del Tesla»: rechazado; es una restricción de seguridad del vehículo, no de la app, y no se elude.
- El navegador del Tesla bloquea el video (no el audio) cuando el carro no está en Park; TECLA LIVE no lo elude. El síntoma «se oye pero no se ve al manejar» se cubre con el Modo conducción del reproductor (`docs/TESLA-VIDEO.md`).
- Waze no ofrece una API pública de consumidor para sus avisos de huecos, cámaras o policía. TECLA LIVE no los recibe ni los dibuja; solo prepara la ruta y enlaza el mapa en vivo oficial. Detectado y documentado en `docs/WAZE.md`.
- `npm audit --omit=dev` reporta 3 avisos altos en la cadena del CLI de Prisma (`deepmerge-ts`). El CLI no está en la imagen runtime final (solo en la imagen de migración, que procesa el schema del repositorio); corregirlo exige un salto mayor a Prisma 7 y se pospone por riesgo de compatibilidad.

- Control remoto: las salas viven en memoria del proceso (como el rate limit). Easypanel corre una sola réplica; con varias habría que usar PostgreSQL/Redis.
- La emulación de geolocalización de Playwright emite un error `POSITION_UNAVAILABLE` entre cada fix; por eso el hook de GPS ahora tolera ese error si hubo un fix en los últimos 15 s (también ayuda en túneles cortos).

## SOLUCIONES VERIFICADAS

- Repositorio inspeccionado con `ls`, `git status` y `find`; estaba vacío y se inicializó Git.
- Versiones estabilizadas contra npm; Next 16.4.2, React 19.3.1, TS 5.9.3, Tailwind 4.3.3, Prisma 6.19.3.
- Playwright + Next dev: usar `http://localhost:3000`, no `127.0.0.1`, porque el HMR de Next dev rechaza el handshake y la hidratación no progresa. Documentado para futuras sesiones.
- Prisma: PostgreSQL local en el puerto 55433 porque 5432/5433 estaban ocupados por otros proyectos; migración `20261020022821_init` aplicada.
- iTunes Search: `lang=es_co` devuelve 400; se eliminó ese parámetro y se usa `country=CO`.
- Docker: Prisma necesita `openssl` y `libc6-compat` en Alpine; se generan binarios musl; la app standalone funciona como usuario `nextjs`.
- Docker compose: el servicio `migrate` con `Dockerfile.migrate` aplica la migración antes de arrancar la app; se verificaron health y tablas.
- Dockerfile.migrate optimizado de 2.01 GB a 751 MB instalando solo Prisma CLI.
- Spotify: los tokens cifrados se guardan en PostgreSQL; el refresh se valida al expirar. OAuth real no probado.
- La verificación de sesión activa en PostgreSQL hace que el logout revoque de inmediato, a costa de una consulta por ruta autenticada (aceptable en esta escala).
- Mock local de DeepSeek permitió probar el protocolo antes de las claves; luego se verificó DeepSeek real con `deepseek-flash`, tool de clima y acción de interfaz.
- Deepgram real transcribió un MP3 generado por ElevenLabs con confianza 0.996 (3.84 s); el ciclo TTS→STT quedó comprobado.
- Spotify `client_credentials` devolvió 200 y la página de authorize aceptó redirect_uri; la vinculación de cuenta sigue siendo un paso interactivo del usuario.
- La prueba de micrófono simulado con Playwright/Chromium quedó bloqueada en `getUserMedia`; no es un fallo de la UI ni de Deepgram, sino una limitación del entorno de automatización.
- Iconos de marca: Simple Icons (CC0) y Disney+ de Wikimedia (dominio público), con atribución en `docs/ATTRIBUTION.md`.
- TECLA DRIVE v2: el prototipo HTML (mph, `let` globales, `ScriptProcessor`) se portó a km/h y a módulos puros; las constantes de marchas se convirtieron (`GEAR_TOP_KMH`) y el acelerador derivado de la aceleración usa umbrales en km/h/s. Para probar E2E con el puerto 3000 ocupado por `tecla-live-prod`, se construye la imagen nueva y se corre en `:3100` con una configuración temporal de Playwright (sin `webServer`); `getByRole` con el nombre del motor debe anclarse con `/^Nombre/` porque el botón de favorito también contiene el nombre.
- En esta máquina, `tsc --noEmit` y `eslint .` tardan varios minutos; conviene lanzarlos en segundo plano y no en paralelo con `next build` local.
- `ALLOWED_APP_IDS` de `schemas.ts` debe conservar el mismo orden que `APPS` del catálogo (hay un test que los compara); al mover TECLA Drive junto a Spotify hubo que reordenar ambos.
- El contenedor local `tecla-live-prod` (puerto 3000) se arranca con `docker run --env-file` a partir de la configuración del contenedor anterior; la imagen se construye con `NEXT_PUBLIC_APP_URL=https://tecla.live` como la previa. El `env-file` vive solo en el scratchpad de la sesión y se borra al terminar.
- El worklet de audio vive en `public/drive/engine-worklet.js` (JS plano, no pasa por TypeScript); `engine-synth.ts` es la referencia y la prueba `tests/unit/drive.test.ts` ejecuta el worklet en `node:vm` con un `random` sembrado para comprobar paridad muestra a muestra. Si se cambia la física, hay que cambiarla en los dos y la prueba lo detecta.
- Autoplay: ningún navegador inicia `AudioContext` sin gesto; el «arranque de un toque» agrupa audio, GPS, fullscreen y wake lock en ese gesto. No prometer arranque automático.
- `next/font/google` (Rajdhani) descarga la fuente en tiempo de build; el build de Docker necesita salida a Internet (ya la usa `npm ci`).

## PRÓXIMOS PASOS

1. Vincular la cuenta de Spotify desde `/music` y probar play/pausa/volumen con Premium y un dispositivo activo.
2. Probar el micrófono real en un navegador (y en el Tesla) y el ciclo de voz completo desde la UI.
3. Desplegar en Easypanel siguiendo `docs/EASYPANEL.md` y verificar tecla.live.
4. Probar en el navegador de un Tesla: autoplay, fullscreen, embeds y rendimiento.
5. Sustituir el rate limit en memoria por PostgreSQL/Redis si se escala a varias réplicas.
6. Evaluar transcripción parcial en streaming con token temporal de Deepgram.
7. Añadir eliminación de cuenta/datos sincronizados si el producto la requiere.
8. TECLA DRIVE: probar en el Tesla GPS (velocidad y rumbo), rendimiento del canvas y DRM de Spotify; requiere TLS válido.
9. TECLA AI: streaming de texto y voz.

## ÚLTIMA ACTUALIZACIÓN

**2026-10-27 America/Bogota** — Fase 9 «experiencia futurista»: arranque tipo nave (`boot-sequence.tsx`), orbe reactivo (`siri-orb.tsx`), Pantalla ambiente (`ambient-screen.tsx`), telemetría GPS (`telemetry.ts`, `drive-telemetry.tsx`), control remoto por QR (`src/lib/remote`, `/api/remote/*`, `/remote/[code]`, dependencia `qrcode`). Preferencias nuevas: `bootSequence`, `ambientIdleMinutes`, `remoteControl`. Documentación en `docs/REMOTE.md`, `docs/AI-JARVIS.md` y `docs/DRIVE.md`. Antes: **2026-10-20 16:45 America/Bogota** — TECLA DRIVE v3 (arranque de un toque, GPS robusto, escena automática, AudioWorklet, `drive_control`); contenedor :3000 con `tecla-live:drive3`. Antes, **16:40** — Jarvis + Cyberpunk + Spotify real: persona Jarvis en TECLA AI, estilo visual Cyberpunk 2077, búsqueda/reproducción de Spotify con reproductor web oficial, Drive junto a Spotify en accesos rápidos. Antes, **16:05** — TECLA DRIVE v2: prototipo HTML del usuario integrado y mejorado en `/drive` (carretera pseudo-3D, 10 escenas, 26 motores sintetizados, transmisión, modos y estudio). Typecheck, lint, 57 unitarias, build Docker y E2E de Drive verdes. Pendiente redesplegar en tecla.live, migrar a `AudioWorklet`, probar en Tesla, micrófono físico y certificado TLS.

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
- [x] Búsqueda universal (⌘K), atajos (⌘J, ?), tema claro/oscuro/automático con horario, modos normal/cine/kiosco, fullscreen con fallback, reducción de movimiento.
- [x] TECLA DRIVE (`/drive`): experiencia original de sonido y paisaje con Canvas 2D, gauge de velocidad simulada y Web Audio (viento, eléctrico, V8 sintético, hiperespacio). Sin GPS, samples ni assets de terceros.
- [x] Iconos de marca reales con atribución: YouTube, Spotify, Waze, Google Maps, Netflix, Disney+, Podcasts y Twitch; Radio/IPTV/TECLA AI conservan iconografía propia.
- [x] YouTube: cliente Data API v3 con caché y cuota, búsqueda/tendencias CO, reproductor IFrame oficial, metadatos, historial con progreso, favoritos, listas, cola y minirreproductor. **Verificado con API real el 2026-10-20.** Fix del crash de `/watch` por reconciliación DOM del iframe y filtro de videos no embebibles.
- [x] TECLA AI texto: 21 herramientas Zod, registro para DeepSeek, orquestación con máximo de pasos y resultados reales, rate limits, presupuesto, ledger de uso, system prompt antiinyección, panel flotante y página `/ai`. **DeepSeek real verificado (texto, tool de clima y action bridge).**
- [x] Function calling de extremo a extremo validado con mock local de DeepSeek: herramienta de clima real, acción de cliente `set_theme`, continuación con `toolExchange` y eventos en `AIUsageEvent`.
- [x] Memoria consentida de preferencias: store local, herramienta `remember_preference`, contexto al modelo, consulta/borrado en Ajustes.
- [x] Voz: STT push-to-talk con subida al backend y Deepgram; TTS ElevenLabs streaming por backend; interrupción, pausa/restauración de media controlada, selector de voces autorizadas y fallback textual. **Deepgram y ElevenLabs reales verificados; captura de micrófono físico pendiente.**
- [x] Radio Browser: búsqueda, top Colombia, HTTPS, reproducción HTML5, favoritos, volumen y control por TECLA AI.
- [x] Podcasts: búsqueda real en iTunes, reproducción del avance público, velocidad, progreso, favoritos y enlace al episodio completo. No se presenta el avance como episodio completo.
- [x] IPTV: parser M3U/M3U8 validado, importación por archivo/texto, categorías, búsqueda, favoritos y reproducción HLS con hls.js.
- [x] Navegación: Waze y Google Maps con deep links oficiales, búsqueda, recientes, favoritos, Casa/Trabajo y sin GPS. Waze incluye tarjeta de avisos con enlace al mapa en vivo; no se simulan huecos/cámaras.
- [x] Twitch: embed oficial con parent dinámico, canales guardados y búsqueda externa. **Sin credenciales de la API de Twitch no hay búsqueda interna de directorio.**
- [x] Netflix y Disney+ como accesos externos oficiales, sin eludir DRM.
- [x] Spotify: OAuth con state, tokens cifrados, estado, now-playing, play/pausa/siguiente/anterior/volumen y desconexión. **Credenciales y redirect validados; falta vincular cuenta y probar reproducción.**
- [x] Cuentas: registro/login/logout, bcrypt, sesiones revocables, `/api/auth/me`, sincronización de favoritos/historial/preferencias y carga de preferencias desde la nube.
- [x] Ajustes completos: apariencia, pantalla, IA/voz, clima, cuenta, orden del dashboard, privacidad, exportación y borrado local.
- [x] Dockerfile multi-stage no root, health check; Dockerfile.migrate; docker-compose con PostgreSQL, migración y app; build e2e de contenedor verificado.
- [x] 49 pruebas unitarias y 27 pruebas E2E (Playwright) aprobadas; lint sin errores.

## ESTADO ACTUAL

Aplicación completa en su alcance verificable. **Build de producción, typecheck, lint (0 errores/6 avisos), 49 unitarias, 27 E2E, PostgreSQL 16, migración, Docker y Compose verificados localmente.** La app está corriendo desde la imagen Docker final en `http://localhost:3000`, con claves reales inyectadas en runtime. **YouTube, DeepSeek, Deepgram y ElevenLabs fueron probados contra sus proveedores reales (2026-10-20).** Spotify validó credenciales y redirect; falta la autorización de la cuenta. Micrófono físico, Tesla y Easypanel siguen pendientes.

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
- Waze no ofrece una API pública de consumidor para sus avisos de huecos, cámaras o policía. TECLA LIVE no los recibe ni los dibuja; solo prepara la ruta y enlaza el mapa en vivo oficial. Detectado y documentado en `docs/WAZE.md`.
- `npm audit --omit=dev` reporta 3 avisos altos en la cadena del CLI de Prisma (`deepmerge-ts`). El CLI no está en la imagen runtime final (solo en la imagen de migración, que procesa el schema del repositorio); corregirlo exige un salto mayor a Prisma 7 y se pospone por riesgo de compatibilidad.

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

## PRÓXIMOS PASOS

1. Vincular la cuenta de Spotify desde `/music` y probar play/pausa/volumen con Premium y un dispositivo activo.
2. Probar el micrófono real en un navegador (y en el Tesla) y el ciclo de voz completo desde la UI.
3. Desplegar en Easypanel siguiendo `docs/EASYPANEL.md` y verificar tecla.live.
4. Probar en el navegador de un Tesla: autoplay, fullscreen, embeds y rendimiento.
5. Sustituir el rate limit en memoria por PostgreSQL/Redis si se escala a varias réplicas.
6. Evaluar transcripción parcial en streaming con token temporal de Deepgram.
7. Añadir eliminación de cuenta/datos sincronizados si el producto la requiere.

## ÚLTIMA ACTUALIZACIÓN

**2026-10-20 13:30 America/Bogota** — Añadido TECLA DRIVE, experiencia original de sonido/paisaje en `/drive`; audio Web Audio verificado, 49 unitarias y 27 E2E. Pendiente redesplegar en tecla.live, probar micrófono físico y corregir el certificado TLS autofirmado.

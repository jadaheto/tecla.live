# PLAN.md — Plan técnico de TECLA LIVE

**Versión:** 1.1 · **Fecha:** 2026-10-19 · **Estado:** Fases 0–7 completadas en alcance verificable

## 1. Arquitectura

Aplicación Next.js 16 App Router desplegable como un único contenedor:

- **Frontend React** con Zustand para estado local, TanStack Query para datos remotos y componentes shadcn/ui.
- **Route Handlers** para todas las integraciones con secretos, autenticación, límites de uso y streaming TTS.
- **Prisma/PostgreSQL** para cuentas, preferencias sincronizadas, favoritos, historial, listas, destinos, conversaciones consentidas y uso de IA.
- **Modo invitado local-first** para que el dashboard funcione sin base de datos ni cuenta.
- **Puente de acciones** servidor↔cliente para que TECLA AI opere la UI sin recibir permisos de sistema.

```
app/                 rutas y API
components/          UI
features/ai/         copiloto
lib/ai/              proveedores + orquestación + seguridad
lib/integrations/    YouTube, Spotify, clima, radio, podcasts, mapas, M3U
stores/              Zustand
prisma/              modelo de datos
tests/               unit + e2e
```

## 2. Etapas y dependencias

| Fase | Entregable | Depende de | Verificación |
| --- | --- | --- | --- |
| 0 | Archivos de control, base del proyecto, objetivo harness | — | typecheck, build |
| 1 | Fundación visual, shell, tema, preferencias, dashboard, navegación, Docker | 0 | build, e2e dashboard |
| 2 | YouTube búsqueda/tendencias/reproductor/historial/favoritos/cola | 1 + `YOUTUBE_API_KEY` | unit URLs, ruta API, E2E sin clave |
| 3 | TECLA AI texto: DeepSeek, tools Zod, action bridge, límites | 1 + `DEEPSEEK_API_KEY` | unit tools, tests de orquestación con fetch simulado, E2E UI |
| 4 | Voz: Deepgram STT, ElevenLabs TTS, interrupciones, fallback | 3 + claves | unit límites/audio, E2E estados |
| 5 | Spotify, Waze, Maps, radio, podcasts, IPTV, Twitch, accesos cine | 1 | unit deep links/M3U, E2E |
| 6 | Cuentas, sync, memoria consentida, recomendaciones, clima, modos | 1, 3 | integración auth/DB, E2E |
| 7 | Tests completos, auditoría, Docker, Easypanel, rendimiento | 1–6 | CI local, build Docker, health |

Las fases 2, 3 y 5 pueden solaparse donde no compartan archivos. La voz no se inicia hasta que TECLA AI texto funcione.

## 3. Orden de implementación

1. Fundación: tokens de diseño, tailwind, layout, header, providers, stores, primitivas UI.
2. Dashboard con datos reales degradables (clima, radio, estado de integraciones) + accesos.
3. Reproductor YouTube y biblioteca local (favoritos, historial, cola, continuar viendo).
4. Ruta de IA: herramientas, orquestador DeepSeek, límites, panel de chat y action bridge.
5. Voz: STT backend, TTS, reproducción interrumpible, UI de estados.
6. Apps: música/Spotify, navegación, radio, podcasts, IPTV, Twitch, cine.
7. Cuentas/PostgreSQL, sincronización, memoria consentida.
8. Calidad: tests, auditoría de seguridad, Docker, Easypanel, documentación.

## 4. Decisiones clave

- **Sin Websocket propio en v1.** STT sube audio al backend (límite 45 s); TTS devuelve audio streaming por HTTP. Menos infraestructura y secretos protegidos. Si se requiere transcripción parcial en tiempo real, evaluar token temporal de Deepgram documentado.
- **YouTube con IFrame oficial.** Nunca descarga ni extracción de streams. Las listas TECLA no se presentan como listas de YouTube.
- **Spotify solo con OAuth y cuenta.** Sin Web Playback SDK garantizado en Tesla; controles remotos y apertura externa.
- **Waze/Maps con deep links oficiales.** No se afirma integración embebida.
- **Auth propia.** JWT HS256 en cookie HttpOnly + hash bcrypt. No se añade proveedor OAuth de login en la v1.
- **Límites de IA.** Valores iniciales: 20 solicitudes/min por sesión, 12/min invitado, 6k tokens de entrada, 700 de salida, 4 pasos de tools, 900 caracteres TTS, 45 s audio y presupuesto mensual de USD 10. Todos configurables.
- **Base de datos opcional.** La falta de `DATABASE_URL` no impide arrancar ni usar el modo invitado.

## 5. Riesgos y mitigación

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Cuota de YouTube agotada | Búsquedas fallan | Caché TTL, límite de resultados, mensajes claros, reintento controlado |
| APIs de IA sin configurar | Sin voz/copiloto | UI de estado, fallback textual, resto del producto operativo |
| Bloqueo de autoplay/fullscreen en Tesla | Acción fallida | Intentar desde gesto, detectar fallo y ofrecer botón manual |
| Costos descontrolados | Gasto | Rate limits, presupuesto, límites de tokens/audio, logs de uso |
| Micrófono no disponible | Sin voz | Push-to-talk opcional, input de texto siempre visible |
| Rate limit en memoria no distribuido | Abuso entre réplicas | Límites de sesión + preparar almacén PostgreSQL/Redis si escala |
| DRM de Netflix/Disney+ | No se puede embeber | Solo apertura oficial en pestaña nueva |
| CORS/HLS en IPTV | Reproducción fallida | Validación de URL, manejo de error, abrir en pestaña si es necesario |
| Node 26 local vs Node 22 Docker | Diferencias | Probar build de contenedor |

## 6. Pruebas

- **Unitarias (Vitest):** esquemas de herramientas, validación de args, URLs Waze/Maps, parser M3U, límites, tema automático, sanitización de texto TTS, rate limiter, auth.
- **Integración:** route handlers con fetch simulado para proveedores (sin gastar crédito), auth contra PostgreSQL local, sincronización de biblioteca.
- **E2E (Playwright):** dashboard en viewport Tesla 1920×1080, navegación táctil, tema, panel de IA, estados vacíos/no configurados, reproductor sin clave, ajustes.
- **Docker:** build de imagen, arranque con Postgres, health check.
- **Manual documentada:** video/audio real con claves, micrófono, fullscreen y navegador Tesla.

## 7. Criterios de aceptación

Los 25 criterios del prompt maestro. Se verificarán en `TASKS.md` con evidencia. Los que dependan de credenciales o hardware quedarán **bloqueados y declarados**, no marcados como completados.

## 8. Variables y presupuesto

Se documentan en `.env.example`. Valores iniciales conservadores; el presupuesto mensual se controla con un ledger y bloqueo de llamadas si se excede. No se incluyen claves reales en el repositorio.

## 9. Despliegue

Dockerfile multi-stage con salida standalone, usuario no root, puerto 3000, `HOSTNAME=0.0.0.0`, health check. `docker-compose.yml` para desarrollo con PostgreSQL. Easypanel: servicio app desde Git + PostgreSQL + variables + `prisma migrate deploy` + HTTPS + health. No se declara desplegado sin comprobación real.

## 10. Orden de trabajo inmediato

1. Cerrar Fase 0 con build verde.
2. Implementar Fase 1 completa y verificable.
3. Implementar YouTube y biblioteca.
4. TECLA AI texto.
5. Voz.
6. Integraciones restantes.
7. Cuentas y sincronización.
8. Producción y auditoría.


## 11. Estado de ejecución (2026-10-19)

- Fases 0–7 implementadas según el orden previsto.
- Verificación: 44 pruebas unitarias, 26 E2E, typecheck, lint, build, PostgreSQL 16, migración, Docker y Compose.
- Bloqueos declarados: credenciales reales de YouTube/DeepSeek/Deepgram/ElevenLabs/Spotify, despliegue Easypanel y prueba física en Tesla.
- Decisiones añadidas: sesiones activas verificadas en PostgreSQL, minirreproductor global, memoria de preferencias consentida, HLS con hls.js, Dockerfile.migrate optimizado y build arg `NEXT_PUBLIC_APP_URL`.
- Detalle y evidencia: `GOAL_LOOP.md`, `TASKS.md` y `memori.md`.

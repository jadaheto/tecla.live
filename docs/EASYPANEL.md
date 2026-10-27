# Despliegue de TECLA LIVE en Easypanel

> Este procedimiento **no se ejecutó** desde el entorno de desarrollo porque no hay acceso a Easypanel ni al dominio. Está diseñado para verificarse paso a paso en el servidor real.

## 1. Requisitos

- Repositorio Git con este proyecto.
- Easypanel con Docker y un servicio PostgreSQL 16 (o compatible).
- Dominio `tecla.live` con DNS apuntando al servidor.
- Claves de los proveedores que quieras activar (YouTube, DeepSeek, Deepgram, ElevenLabs, Spotify).
- `AUTH_SECRET` y `TOKEN_ENCRYPTION_KEY` generados para producción.

Genera los secretos en tu máquina, no en el repositorio:

```bash
openssl rand -hex 32   # AUTH_SECRET
openssl rand -hex 32   # TOKEN_ENCRYPTION_KEY
```

## 2. Crear PostgreSQL

1. En Easypanel, crea un servicio **PostgreSQL 16** llamado, por ejemplo, `tecla-db`.
2. Anota el hostname interno, puerto, usuario, contraseña y base de datos.
3. Construye la URL interna:

```text
postgresql://USUARIO:CONTRASEÑA@HOST_INTERNO:5432/tecla?schema=public
```

No uses `localhost` dentro de un contenedor: usa el hostname interno que Easypanel asigna al servicio de base de datos.

## 3. Crear el servicio de aplicación

1. Crea un servicio **App** desde el repositorio Git.
2. Build method: **Dockerfile** en la raíz del repositorio.
3. Puerto expuesto: **3000**.
4. Health check: `GET /api/health` (responde 200 y muestra el estado de la base de datos).
5. Build arg recomendado: `NEXT_PUBLIC_APP_URL=https://tecla.live`. Next inyecta las variables `NEXT_PUBLIC_*` en el build; si cambias el dominio, vuelve a compilar la imagen.
6. Si Easypanel inyecta `PORT=80` (verás «Local: http://localhost:80» en el log), configura el puerto del dominio/proxy en **80**; si no defines `PORT`, usa **3000**. El health check de la imagen sigue al valor de `PORT`, así que cualquiera de las dos opciones queda verde. Un servicio en amarillo con «Ready» en el log casi siempre es un desajuste entre `PORT` y el puerto del proxy.
7. La imagen corre con usuario no root (`nextjs`).

## 4. Variables de entorno

Configura en Easypanel (nunca en el repositorio):

| Variable | Obligatoria | Valor |
| --- | --- | --- |
| `APP_URL` | Sí | `https://tecla.live` |
| `NEXT_PUBLIC_APP_URL` | Sí | `https://tecla.live` |
| `DATABASE_URL` | Sí para cuentas | URL interna de PostgreSQL |
| `AUTH_SECRET` | Sí para cuentas | 32 bytes aleatorios en hexadecimal |
| `TOKEN_ENCRYPTION_KEY` | Sí para Spotify | 32 bytes aleatorios en hexadecimal |
| `YOUTUBE_API_KEY` | Opcional | YouTube Data API v3 |
| `DEEPSEEK_API_KEY` | Opcional | API key oficial de DeepSeek |
| `DEEPSEEK_BASE_URL` | Opcional | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | Opcional | `deepseek-chat` (modelo oficial estable) |
| `DEEPGRAM_API_KEY` | Opcional | Deepgram |
| `DEEPGRAM_MODEL` | Opcional | `nova-3` |
| `ELEVENLABS_API_KEY` | Opcional | ElevenLabs |
| `ELEVENLABS_VOICE_ID` | Opcional | ID real de una voz de tu cuenta |
| `ELEVENLABS_MODEL_ID` | Opcional | `eleven_flash_v2_5` |
| `ELEVENLABS_VOICES` | Opcional | Voces públicas de Ajustes: `id\|Nombre\|grupo\|género;…` (ver `.env.example`). Sin ella se usa una lista de respaldo. |
| `ELEVENLABS_KITT_VOICE_ID` | Opcional | Voz grave para el estilo «El auto fantástico». Sin ella se usa la primera voz masculina grave de `ELEVENLABS_VOICES`. |
| `SPOTIFY_CLIENT_ID` | Opcional | App de Spotify Developer |
| `SPOTIFY_CLIENT_SECRET` | Opcional | App de Spotify Developer |
| `SPOTIFY_REDIRECT_URI` | Opcional | `https://tecla.live/api/spotify/callback` |
| `TESLA_CLIENT_ID` | Opcional | App de developer.tesla.com (Fleet API). Ver `docs/TESLA-FLEET.md`. |
| `TESLA_CLIENT_SECRET` | Opcional | App de developer.tesla.com |
| `TESLA_DOMAIN` | Opcional | Dominio registrado en Tesla: `sinapsia.co` |
| `TESLA_REDIRECT_URI` | Opcional | `https://sinapsia.co/tesla/callback.php` (reenvía a tecla.live) |
| `TESLA_REGION` | Opcional | `na` (América) o `eu` |
| `TESLA_SCOPES` | Opcional | Permisos extra (`vehicle_cmds`) para la fase 2 |
| `GOOGLE_MAPS_EMBED_KEY` | Opcional | Clave del Maps Embed API (restringida a `https://tecla.live/*`) para la ruta de Google dentro de Navegar. Ver `docs/NAVIGATION.md`. |
| `GOOGLE_MAPS_MAP_ID` | Opcional | Map ID vectorial para el modo navegación (requiere Maps JavaScript API y Routes API en la clave). |
| `OPENCHARGEMAP_API_KEY` | Opcional | Clave gratuita de Open Charge Map para la pestaña «Cargadores» (sin ella solo queda la vista PlugShare) |
| `AI_MAX_INPUT_TOKENS` | Opcional | `6000` |
| `AI_MAX_OUTPUT_TOKENS` | Opcional | `700` |
| `AI_MAX_TOOL_STEPS` | Opcional | `4` |
| `AI_MONTHLY_BUDGET_USD` | Opcional | `10` |
| `AI_GUEST_RATE_LIMIT` | Opcional | `12` |
| `AI_CHAT_RATE_LIMIT` | Opcional | `20` |
| `AI_TTS_RATE_LIMIT` | Opcional | `20` |
| `AI_STT_RATE_LIMIT` | Opcional | `20` |
| `AI_MAX_TTS_CHARS` | Opcional | `900` |
| `AI_MAX_AUDIO_SECONDS` | Opcional | `45` |

La aplicación arranca aunque falten las claves opcionales. El estado real se consulta en `GET /api/integrations/status` y en `/settings`.

## 5. Migraciones de base de datos

Elige **una** de estas opciones antes de publicar la nueva versión:

### Opción A — Worker temporal en Easypanel (recomendada sin CI)

1. Crea un segundo servicio de tipo worker/app desde el mismo repositorio.
2. Build method: **Dockerfile** y archivo `Dockerfile.migrate` (si tu versión de Easypanel permite indicar el nombre del Dockerfile; si no, usa una rama/entorno con ese archivo como `Dockerfile`).
3. Configura `DATABASE_URL` con la URL interna de PostgreSQL.
4. Ejecuta el servicio una sola vez. El comando es `npx prisma migrate deploy`.
5. Cuando termine correctamente, detén el worker. No lo dejes como servicio permanente.

### Opción B — Desde CI o una máquina con acceso a la base

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

### Opción C — Docker Compose local

`docker-compose.yml` incluye un servicio `migrate` que se ejecuta antes de la app:

```bash
docker compose up --build
```

La app espera a que la migración termine (`service_completed_successfully`).

> No uses `prisma migrate dev` en producción. No borres el volumen de PostgreSQL. Haz respaldo antes de una migración destructiva.

## 6. Dominio y HTTPS

1. Agrega el dominio `tecla.live` al servicio de app.
2. Activa HTTPS/Let's Encrypt en Easypanel.
3. Redirige `www.tecla.live` a `tecla.live` si lo deseas.
4. Actualiza `APP_URL`, `NEXT_PUBLIC_APP_URL` y `SPOTIFY_REDIRECT_URI` para que coincidan exactamente con el dominio y el protocolo.
5. En el panel de Spotify Developer, agrega exactamente `https://tecla.live/api/spotify/callback` como Redirect URI.

## 7. Verificación posterior al despliegue

```bash
curl -fsS https://tecla.live/api/health
curl -fsS https://tecla.live/api/integrations/status
```

Comprueba en el navegador:

- [ ] `/` carga con clima real de Sincelejo.
- [ ] Tema claro/oscuro y recarga mantienen preferencia.
- [ ] Búsqueda universal responde y no rompe la app si YouTube falta.
- [ ] `/settings` muestra el estado real de cada integración.
- [ ] Registro e inicio de sesión funcionan si PostgreSQL y `AUTH_SECRET` están configurados.
- [ ] La sincronización de biblioteca responde y persiste tras recargar.
- [ ] YouTube carga tendencias y reproduce con el reproductor oficial (si hay cuota).
- [ ] DeepSeek responde por texto y ejecuta una herramienta permitida.
- [ ] El micrófono pide permiso, Deepgram transcribe y ElevenLabs responde con voz.
- [ ] La radio reproduce una emisora HTTPS.
- [ ] Los podcasts muestran avances y el enlace al episodio completo.
- [ ] Waze y Google Maps abren enlaces oficiales.
- [ ] IPTV importa una lista M3U autorizada de prueba.
- [ ] Twitch embed carga con el parent correcto.
- [ ] Spotify vincula la cuenta y muestra el estado de reproducción.
- [ ] El health check permanece en 200 si la base de datos se cae (muestra `unavailable`).

## 8. Operación y seguridad

- Mantén las claves solo en variables del servidor. Nunca uses `NEXT_PUBLIC_` para secretos.
- `AUTH_SECRET` y `TOKEN_ENCRYPTION_KEY` deben ser estables entre despliegues; rotarlos invalida sesiones y tokens de Spotify.
- El rate limit de IA está en memoria por instancia. Si escalas a varias réplicas, migra los límites a PostgreSQL/Redis o usa un balanceador con afinidad.
- Revisa el gasto de proveedores en sus paneles y ajusta `AI_MONTHLY_BUDGET_USD`, tokens, audio y TTS.
- No guardamos audio ni transcripciones. Verifica la política de retención de Deepgram, DeepSeek y ElevenLabs en sus cuentas.
- No hay panel administrativo. La configuración es por variables de entorno.
- Programa respaldos de PostgreSQL y prueba una restauración.
- Revisa logs sin volcar tokens; la app redacta campos sensibles.
- Usa el botón de salud y los logs del contenedor para diagnosticar reinicios.

## 9. Rollback

1. Conserva la imagen/versión anterior en Easypanel.
2. Si una migración es compatible hacia atrás, vuelve a desplegar la imagen anterior.
3. Si la migración es destructiva, restaura el respaldo de PostgreSQL antes de volver atrás.
4. Nunca ejecutes `prisma migrate reset` en producción.

## 10. Estado de esta verificación

- El build de Docker y el arranque con PostgreSQL se prueban localmente según `TASKS.md`.
- El despliegue en Easypanel y el dominio real **no** se declaran verificados desde este entorno.

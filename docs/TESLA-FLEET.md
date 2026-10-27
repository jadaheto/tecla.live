# Tesla Fleet API en TECLA LIVE

> Fase 1 (2026-10-27): **solo lectura**. Batería, autonomía, estado y tiempo de carga, temperatura, bloqueo y odómetro del vehículo del usuario, en Inicio, Pantalla ambiente, arranque y por voz. Sin comandos.

## Por qué el dominio es sinapsia.co y no tecla.live

developer.tesla.com rechazó `tecla.live` («el dominio no es válido… no incluya la palabra Tesla…»). El certificado y el servidor de tecla.live son válidos y no hay proxy inverso delante; la causa es el **parecido del nombre** con «tesla». La app quedó registrada con `sinapsia.co` (hosting en Hostinger del propietario). TECLA LIVE sigue viviendo en tecla.live: sinapsia.co solo hace dos cosas:

1. Servir la **llave pública** en `https://sinapsia.co/.well-known/appspecific/com.tesla.3p.public-key.pem`.
2. **Reenviar el callback** de OAuth a tecla.live con un `callback.php` de dos líneas.

## Archivos para Hostinger (public_html)

```
public_html/
  .well-known/
    .htaccess                                   # permite servir la carpeta y fija text/plain
    appspecific/com.tesla.3p.public-key.pem     # llave pública EC P-256
  tesla/
    callback.php                                # 302 a https://tecla.live/api/tesla/callback?<query>
```

`callback.php`:

```php
<?php
header("Location: https://tecla.live/api/tesla/callback?" . $_SERVER["QUERY_STRING"], true, 302);
exit;
```

La llave se genera con `openssl ecparam -name prime256v1 -genkey -noout -out tesla-private-key.pem` y `openssl ec -in tesla-private-key.pem -pubout -out com.tesla.3p.public-key.pem`. La **privada no se sube a ningún lado** todavía: solo hará falta en la fase 2 (firma de comandos) y vivirá como variable de entorno del servidor.

Comprobación: `curl -s https://sinapsia.co/.well-known/appspecific/com.tesla.3p.public-key.pem` debe devolver `-----BEGIN PUBLIC KEY-----`.

## Configuración en developer.tesla.com

- Allowed Origin: `https://sinapsia.co`
- Allowed Redirect URI: `https://sinapsia.co/tesla/callback.php`
- Permisos: Información del vehículo, Ubicación del vehículo, Vehicle Charging Management. (Vehicle Commands solo para la fase 2.)

## Variables de entorno (Easypanel)

| Variable | Valor |
| --- | --- |
| `TESLA_CLIENT_ID` / `TESLA_CLIENT_SECRET` | De la app en developer.tesla.com |
| `TESLA_DOMAIN` | `sinapsia.co` |
| `TESLA_REDIRECT_URI` | `https://sinapsia.co/tesla/callback.php` |
| `TESLA_REGION` | `na` |
| `TESLA_SCOPES` | vacío (fase 1) |

Requiere además `TOKEN_ENCRYPTION_KEY` y `DATABASE_URL`: los tokens se guardan cifrados (AES-256-GCM) en `ConnectedAccount` con provider `tesla`, igual que Spotify. No hay migración nueva.

## Puesta en marcha (orden)

1. Variables en Easypanel y redespliegue.
2. Archivos en Hostinger; comprobar la URL de la llave pública.
3. En tecla.live, con sesión iniciada: Ajustes → Mi Tesla → **Registrar ahora** (registro de socio: `POST /api/1/partner_accounts` con token de aplicación). Tesla responde el detalle; HTTP 200 o 201 es correcto.
4. Ajustes → Mi Tesla → **Vincular mi Tesla** → autoriza en auth.tesla.com → vuelve a tecla.live con «Tu Tesla quedó vinculado».
5. Inicio muestra la tarjeta «Mi Tesla». Si el auto duerme, aparece «Despertar» (no se despierta solo: gasta batería).
6. Pregúntale a TECLA AI «¿cuánta batería tengo?» (herramienta `get_vehicle_status`).

## Cómo funciona por dentro

- `src/lib/integrations/tesla.ts`: URL de autorización (`auth.tesla.com/oauth2/v3`), intercambio y refresco de tokens con `audience` regional, lectura de `/api/1/vehicles` y `/api/1/vehicles/{id}/vehicle_data?endpoints=charge_state;climate_state;drive_state;vehicle_state`, normalización a km y °C, caché en memoria de **2 minutos** por usuario, `wake_up` explícito y registro de socio.
- Rutas: `/api/tesla/login`, `/callback`, `/status`, `/vehicle` (`?refresh=1` salta la caché, máximo 6 por minuto), `/wake` (3 cada 5 min), `/disconnect`, `/partner` (3 cada 10 min). Todas exigen sesión en TECLA.
- La tarjeta y la Pantalla ambiente consultan `/api/tesla/vehicle` cada 2 minutos con la pestaña visible; el servidor reutiliza la caché, así que el costo real es como máximo una lectura cada 2 minutos por usuario.
- Un auto `asleep`/`offline` o un `408` se muestran como «durmiendo» sin cifras inventadas.

## Costos y límites

La Fleet API cobra por uso con una franja gratuita mensual (ver precios en el portal de Tesla). TECLA limita las lecturas con caché y sondeo solo con la app abierta. Despertar el vehículo consume batería del auto y está limitado a 3 veces cada 5 minutos.

## Fase 2 (pendiente)

Comandos (clima, maletero, límite de carga, iniciar/detener carga) exigen firma con la llave privada mediante el proxy oficial `tesla-http-proxy` (Go), un contenedor adicional en Easypanel y el permiso `vehicle_cmds`. Además hay que emparejar la llave virtual desde `https://tesla.com/_ak/sinapsia.co` en la app de Tesla.

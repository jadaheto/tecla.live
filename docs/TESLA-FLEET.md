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

## Pantalla «Mi Tesla» (`/tesla`, 2026-10-27)

Pantalla dedicada, junto a Drive en la navegación y en los accesos rápidos («Mi Tesla»), con todo lo que los permisos de lectura permiten:

- **Resumen** con holograma: batería, autonomía, estado de carga, bloqueo, cable, clima, Centinela y presencia a bordo; botones «Actualizar» (salta la caché, máximo 6 por minuto) y «Despertar» si el auto duerme.
- **Batería y carga**: nivel y utilizable, autonomía nominal y estimada, límite y máximo, potencia con voltaje y amperaje, tiempo restante y velocidad de carga, energía y km añadidos, puerto y seguro, cable y carga rápida, amperaje solicitado, programación, calentador de batería y preacondicionamiento.
- **Clima**: interior y exterior, estado, ajuste de conductor y pasajero, ventilador, asientos, volante, desempañadores, protección de cabina y modo «keeper».
- **Carrocería y seguridad**: bloqueo, puertas, maleteros, ventanas, Centinela, valet, cámara, presencia y arranque remoto.
- **Llantas**: presión TPMS de las cuatro (bar) con avisos.
- **Ubicación y marcha**: marcha, velocidad, rumbo, potencia, odómetro, coordenadas con enlace a Google Maps y hora del fix.
- **Vehículo y software**: modelo (según `car_type`), acabado, color, ruedas, interior, puerto, VIN (últimos 6), versión, actualización pendiente con progreso, unidades del auto y mercado.
- **Cargadores cercanos** (`/api/tesla/chargers`, `nearby_charging_sites`, caché 10 min, requiere auto despierto): Supercargadores con plazas libres y cargadores de destino, distancia en km y enlace al mapa.
- **Historial de carga** (`/api/tesla/charging-history`, `dx/charging/history`, caché 30 min): últimas sesiones facturadas por Tesla con sitio, fecha, kWh y total. Las cargas en casa no aparecen (Tesla solo factura Supercargadores).

Servidor: `getTeslaDetail` reutiliza la misma lectura cruda (`vehicle_data` con `charge_state;climate_state;drive_state;vehicle_state;vehicle_config;gui_settings`) que la tarjeta, así que abrir la pantalla no añade consultas. `normalizeVehicleDetail` convierte millas a km y expone puertas/ventanas como booleanos. TECLA AI abre la pantalla con «abre mi Tesla» (`open_app` → `tesla`) y el control remoto también.

## Modo carga automático y avisos por voz (2026-10-27)

- **Tesla en vivo** (`src/components/tesla/tesla-provider.tsx`): con la cuenta vinculada, la app mantiene la lectura del vehículo cada 2 minutos (misma caché del servidor) y la publica en `useTeslaLive` (`src/features/tesla/store.ts`) con `parked` (P o sin marcha y velocidad 0 → estacionado; D/R/N o velocidad > 0 → en marcha; dormido → desconocido).
- **Modo carga** (`teslaChargeMode`, activo por defecto): al detectar «cargando» abre la Pantalla ambiente con un panel de carga (porcentaje actual → límite, barra con marca del límite, kW y tiempo restante) y la cierra al terminar la carga, al desconectar o si el auto arranca. Nunca tapa un video, IPTV, Drive ni a TECLA AI. Si el usuario la cierra con un toque, no se reabre hasta la siguiente carga (`chargeDismissed`). Lógica pura en `src/features/tesla/alerts.ts` (`chargeModeDecision`).
- **Estacionado real**: la Pantalla ambiente por inactividad nunca se activa si el Tesla reporta que está en marcha.
- **Avisos por voz** (`teslaVoiceAlerts`, umbral `teslaLowBatteryPercent` 10/20/30): batería baja (una vez por sesión, al abrir la app, si no está cargando), carga iniciada (con kW y tiempo), carga completa (con autonomía) y auto sin bloquear (una vez, estacionado y sin nadie dentro). Se construyen localmente en la voz de la persona activa (`teslaAlerts`) y se pronuncian con `announce()` (`src/features/ai/announce.ts`): solo síntesis de voz, sin DeepSeek; el texto también aparece como notificación. El navegador puede bloquear el audio hasta el primer toque; el texto queda igual.
- Verificación: `tests/unit/tesla-alerts.test.ts` (estacionado, decisiones del modo carga, avisos y transiciones) y prueba con la API simulada en Playwright: la pantalla ambiente se abre sola al cargar con el panel «Cargando · 11 kW · 64 % → 90 % · 1 h 15 min», se cierra con un toque sin reabrirse, y con 15 % sin cargar aparece el aviso de batería baja y el de auto sin bloquear.

## Costos y límites

La Fleet API cobra por uso con un crédito gratuito mensual (ver la tabla vigente en el portal de Tesla). Lo que TECLA consume, con la app abierta en la pantalla del auto:

| Situación | Consultas a Tesla |
| --- | --- |
| Auto despierto, cualquier pantalla (Inicio, Mi Tesla, Pantalla ambiente, arranque) | 1 lectura de `vehicle_data` cada 2 min (todas comparten la caché del servidor) |
| Auto dormido | 1 consulta cada 10 min (solo confirma que duerme; no lo despierta) |
| Lista de vehículos | 1 cada hora |
| Pantalla Mi Tesla abierta | + cargadores cercanos cada 10 min (solo despierto) y historial cada 30 min |
| «Actualizar» | 1 lectura por toque, máximo 6 por minuto |
| «Despertar» | 1 wake-up por toque, máximo 3 cada 5 min (es la operación más cara y gasta batería) |
| TECLA AI «¿cuánta batería tengo?» | usa la caché; solo consulta si pasaron más de 2 min |

Con la pestaña oculta el sondeo se pausa. Dos horas diarias de uso con el auto despierto son unas 60 lecturas al día (≈1.800 al mes), muy por debajo del crédito gratuito con los precios publicados por Tesla en 2025. Despertar el vehículo consume batería del auto y es la única acción que conviene no automatizar.

## Fase 2 (pendiente)

Comandos (clima, maletero, límite de carga, iniciar/detener carga) exigen firma con la llave privada mediante el proxy oficial `tesla-http-proxy` (Go), un contenedor adicional en Easypanel y el permiso `vehicle_cmds`. Además hay que emparejar la llave virtual desde `https://tesla.com/_ak/sinapsia.co` en la app de Tesla.

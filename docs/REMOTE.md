# Control remoto desde el celular

> Un pasajero escanea un código QR en la pantalla del auto y controla TECLA LIVE desde su celular, sin instalar nada ni iniciar sesión. Añadido el 2026-10-27.

## Cómo funciona

1. En el auto, Ajustes → Control remoto → «Permitir control remoto» (o el botón QR de la cabecera). El auto abre una **sala** en el servidor (`POST /api/remote/session`) y recibe un **código** de seis letras y un **token** largo que solo conoce el auto.
2. La cabecera muestra el QR con la URL `https://tecla.live/remote/<código>`. El celular la abre: es una pantalla aparte, sin cabecera ni reproductor (`src/app/remote/[code]/page.tsx`).
3. El celular envía órdenes (`POST /api/remote/<código>/command`) y consulta cada 3 s qué suena en el auto (`GET /api/remote/<código>`).
4. El auto recibe las órdenes por Server-Sent Events (`GET /api/remote/<código>/events?token=…`) y las ejecuta con los mismos controladores que usa TECLA AI (`getMediaController`, navegación interna, `openAssistant`). Publica su estado (`POST /api/remote/<código>/state`, cabecera `x-remote-token`) cada 6 s y tras cada orden.

## Órdenes aceptadas

| Orden | Efecto en el auto |
| --- | --- |
| `play`, `pause`, `next` | Reproductor activo (radio, Spotify, YouTube, podcast) |
| `volume` (`delta` −50…50) | Volumen de la app (radio y voz de TECLA AI) |
| `open` (`screen` de una lista fija) | Inicio, Videos, Spotify, Radio, Podcasts, Navegar, Drive, Ajustes |
| `ambient` (`on`) | Abre o cierra la Pantalla ambiente |
| `style` | Cambia el estilo visual |
| `ask` (`text`, ≤ 240 caracteres) | Se envía como texto a TECLA AI en el auto; la respuesta suena allá |

Todo se valida con Zod (`src/lib/remote/schema.ts`): no se aceptan URLs, rutas libres ni texto ejecutable. El modelo de IA nunca ve el token.

## Seguridad y límites

- El código tiene 6 caracteres de un alfabeto sin ambigüedades (32 símbolos → ~10⁹ combinaciones) y solo sirve mientras el auto mantenga la sala abierta. El token (48 hex) autoriza recibir órdenes y publicar estado; nunca se muestra en el QR.
- Las salas viven en memoria del servidor y caducan tras **3 horas sin actividad**; máximo 400 salas. Con varias réplicas habría que moverlas a PostgreSQL o Redis (igual que el rate limit).
- Límites por IP: 20 sesiones cada 10 min, 90 órdenes por minuto, 120 consultas por minuto.
- No se guarda nada del celular; el estado publicado solo contiene pantalla, título, tipo de reproducción, volumen, estilo y si la Pantalla ambiente está abierta.
- Al apagar el interruptor, cerrar la pestaña o «Generar código nuevo», el código anterior deja de funcionar. Al recargar la pestaña del auto, la sala se retoma con el token guardado en `sessionStorage`.

## Verificación

Prueba automatizada con Playwright (2026-10-27): el auto abre el diálogo y muestra el QR; un contexto móvil (iPhone 13) abre `/remote/<código>`, ve «Auto conectado», sube el volumen (60 → 70 en las preferencias del auto), abre Spotify (el auto navega a `/music`) y activa la Pantalla ambiente. Pruebas unitarias en `tests/unit/remote.test.ts` (contrato, salas, expiración, autorización).

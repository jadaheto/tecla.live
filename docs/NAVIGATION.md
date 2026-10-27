# Navegar: ruta de Google dentro de TECLA LIVE

> Añadido el 2026-10-27. Decisión del usuario: quedarse en tecla.live (opción «C») en lugar de enviar el destino al navegador del Tesla (requiere comandos firmados) o construir un navegador propio.

## Qué hace

- Al buscar un destino en **Navegar**, o al llegar desde **Cargadores** con «Ir», aparece la **ruta de Google embebida** (Maps Embed API, modo `directions`), con tráfico en vivo, en español y región Colombia. No sales de TECLA.
- **Origen**: la posición real del Tesla si el destino vino de Cargadores con el auto vinculado; si no, la ubicación del navegador (se pide una vez, solo cuando hay destino). Sin permiso, el mapa muestra el destino sin ruta y lo dice.
- **«Seguir mi posición»**: con el GPS del navegador, el origen se actualiza cuando te mueves más de 150 m (máximo cada 45 s) y la ruta se redibuja. No es guía por voz: es el mapa de Google con el trayecto. Los botones «Abrir ruta en Waze» y «Abrir en Google Maps» siguen debajo para quien quiera la guía hablada.

## Modo navegación (2026-10-27)

Con la misma clave más un **Map ID vectorial** (`GOOGLE_MAPS_MAP_ID`), Navegar ofrece **«Iniciar navegación en TECLA»** y Cargadores arranca directo con «Ir» (`nav=1`):

- Mapa de Google (Maps JavaScript API, vectorial) **inclinado a 60°, que gira con el rumbo y sigue al auto** (el auto queda en el tercio inferior); tráfico en vivo (`TrafficLayer`); al arrastrar el mapa deja de seguir y aparece el botón para recentrar.
- **Ruta** con Routes API (`computeRoutes`, `TRAFFIC_AWARE`, español, Colombia), llamada desde el navegador con la clave restringida por referente; una llamada al empezar y una por desvío confirmado (3 lecturas seguidas a más de 60 m de la ruta, como mucho cada 30 s).
- **Maniobra actual en grande** con icono y distancia, la siguiente debajo, llegada estimada, tiempo y kilómetros restantes, velocidad.
- **Voz de TECLA** (preferencia `navVoice`, botón en la barra): aviso a 500 m en pasos largos y a 120 m, «Recalculando la ruta» y «Llegaste a tu destino». Cada aviso es una síntesis de ElevenLabs; con la voz apagada no cuesta nada.
- Pantalla encendida con `wakeLock`; «Salir» vuelve a Navegar.
- Lógica pura y probada en `src/features/navigation/guidance.ts` (decodificación de polilíneas, posición sobre la ruta, lo que falta, avisos, desvío); mapa y GPS en `src/components/navigation/navigation-mode.tsx`; Routes API en `src/features/navigation/routes-api.ts`; cargador del API en `src/lib/google-maps-loader.ts`.

Qué no es: no hay avisos de huecos, cámaras ni policía (exclusivos de Waze). Los límites de velocidad dependen de Google. El GPS es el del navegador del Tesla (como en Drive).

Costos: Maps JavaScript API y Routes API tienen precio por uso con un cupo mensual gratuito por API en Google Maps Platform (revisar la consola). TECLA carga el mapa una vez por sesión de navegación y pide una ruta por viaje más los recálculos por desvío.

Configuración adicional: habilitar **Maps JavaScript API** y **Routes API** en la misma clave (añadirlas a la restricción de API), crear el Map ID vectorial en Map Management (ahí se elige también el estilo, por ejemplo oscuro) y poner `GOOGLE_MAPS_MAP_ID` en Easypanel.

## Configuración (una vez)

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto (o usa uno) con **facturación habilitada** (Google lo exige aunque el Embed API no tenga costo).
2. Habilita la API **Maps Embed API**.
3. Credenciales → crear **clave de API**. Restríngela:
   - Restricción de aplicación: **Referentes HTTP** → `https://tecla.live/*`.
   - Restricción de API: **solo Maps Embed API**.
4. En Easypanel añade `GOOGLE_MAPS_EMBED_KEY=<clave>` y redespliega.

La clave viaja en la URL del iframe (así funciona el Embed API), por eso las restricciones son la protección real: con ellas, la clave no sirve desde otro sitio ni para otras APIs. `/api/maps/embed-key` la entrega al navegador y no la registra.

## Costos

Google documenta el Maps Embed API como **sin costo y sin límite de uso**. TECLA no usa Directions API ni Maps JavaScript API (esas sí cobran). Si en el futuro se quisiera guía por voz o reenrutado propio, habría que evaluar otras APIs de pago.

## Implementación

- `src/lib/integrations/google-maps-embed.ts`: URLs de `directions` y `place`, distancia para el seguimiento.
- `src/components/navigation/google-route-map.tsx`: iframe, clave desde `/api/maps/embed-key`, seguimiento por `watchPosition`, estado «no configurado».
- `src/features/navigation/components/navigate-page.tsx`: origen (Tesla → navegador → ciudad), nota de origen y el mapa sobre la tarjeta de enlaces.
- `src/app/api/maps/embed-key/route.ts`, variable `GOOGLE_MAPS_EMBED_KEY` (`src/lib/env.ts`, `integrationStatus.mapsEmbed`).

## Privacidad

Las coordenadas de origen y destino se envían a Google para dibujar la ruta (igual que al abrir Google Maps). TECLA no las guarda. El permiso de ubicación se pide solo cuando hay un destino.

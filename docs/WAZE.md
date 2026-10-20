# Waze en TECLA LIVE — alcance real

## Qué funciona hoy

- Búsqueda de destinos y **deep link oficial** de Waze:
  `https://www.waze.com/ul?q=DESTINO&navigate=yes`
- Enlace a Google Maps como alternativa.
- Destinos recientes, favoritos, Casa y Trabajo guardados localmente.
- Enlace oficial al [mapa en vivo de Waze](https://www.waze.com/live-map/), donde Waze muestra sus reportes de tráfico y alertas de la comunidad.
- TECLA AI puede preparar una búsqueda de Waze con `search_waze` y abrir la pantalla de navegación; no afirma que las alertas estén dentro de TECLA LIVE.

## Qué no es posible con APIs públicas

Los avisos de **huecos, cámaras de velocidad, policía y otros incidentes** son datos generados por la comunidad y mostrados por Waze. Waze **no ofrece una API pública de consumidor** para leer o dibujar esas alertas en otra aplicación. El feed para socios (Waze for Cities / Connected Citizens) requiere un acuerdo y credenciales, y no se puede asumir que esté disponible.

Por eso TECLA LIVE:

- No simula ni inventa alertas.
- No hace scraping no autorizado del mapa de Waze.
- No afirma que Waze funcione embebido o con navegación turn-by-turn dentro de la app.
- No puede mostrar los avisos en Tesla sin acceso autorizado a una fuente de datos.

El botón **«Abrir mapa en vivo de Waze»** lleva al mapa oficial donde Waze sí muestra sus avisos. La navegación con alertas nativas requiere la app oficial de Waze y un dispositivo compatible.

## Opciones si quieres alertas dentro de TECLA LIVE

1. **Waze for Cities / partner feed**: solicitar acceso oficial y configurar un backend que normalice los incidentes. Requiere autorización de Waze.
2. **Proveedor licenciado**: TomTom Traffic Incidents, HERE o Google Roads, con clave y términos de uso.
3. **Datos propios o comunitarios** con consentimiento y moderación.

Ninguna de esas opciones está configurada actualmente. Si se obtiene una fuente autorizada, el trabajo sería:

- Nueva ruta server-side con caché y rate limit.
- Modelo normalizado de incidentes (tipo, posición, carretera, actualización).
- Capa de mapa y lista de alertas con fecha de actualización.
- Herramienta de TECLA AI para consultar alertas cerca de una ruta, sin inventar datos.
- Pruebas con datos reales y revisión de licencia.

## Seguridad

Waze y TECLA LIVE no pueden conocer de forma fiable el estado de conducción del vehículo. No manipules la pantalla mientras conduces. Usa los controles del vehículo o detente en un lugar seguro.

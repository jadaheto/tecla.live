# Video de YouTube en marcha: qué pasa y qué hace TECLA LIVE

## Síntoma

Al empezar a conducir, el video de YouTube deja de verse (pantalla negra) pero el audio continúa.

## Causa

Es una restricción del navegador del Tesla, no un fallo de TECLA LIVE: cuando el carro no está en Park, el navegador bloquea la reproducción de video y deja solo el audio; en algunas versiones muestra el aviso «Video playback while driving is restricted». Pasa con cualquier sitio, incluido youtube.com. TECLA LIVE usa el reproductor oficial de YouTube (IFrame API), así que está sujeto a la misma regla.

TECLA LIVE **no intenta saltar esa restricción**: existe para evitar distracciones al volante.

## Qué se hizo

- **Modo conducción** en `/watch/[videoId]`: una capa con carátula del video, título, canal, barra de progreso y controles grandes (reproducir/pausar, siguiente, «Ver video») sobre el reproductor. Así la pantalla no queda negra mientras el audio sigue. Se activa con el botón «Modo conducción» (también en modo cine) y se recuerda entre videos (`watchAudioMode`).
- **TECLA AI**: «activa el modo conducción» o «el video se ve negro» → `set_display_mode` con `audio`. El prompt explica la restricción sin inventar soluciones.
- La carátula es una imagen estática (`i.ytimg.com/vi/<id>/maxresdefault.jpg`, con respaldo a la miniatura de la API), permitida por el navegador en marcha.

## Recomendación de uso en el Tesla

1. Estacionado: elige el video con normalidad.
2. Antes de arrancar: toca «Modo conducción» (o pídeselo a TECLA AI). El audio sigue y ves la carátula con controles.
3. Al estacionar: «Ver video».

# Hoja de ruta de TECLA LIVE (a partir del 2026-10-21)

Principio rector: la mejor experiencia posible **dentro de lo que el vehículo permite**. No se implementan rodeos a las restricciones de seguridad del Tesla (video en marcha). Todo lo que sigue es compatible con esa regla y verificable.

## Fase A — Lo que desbloquea todo lo demás (infraestructura, 1–2 días)

1. **Certificado TLS válido en tecla.live** (Let's Encrypt en Easypanel). Sin esto el navegador del Tesla bloquea GPS y micrófono: Drive y la voz de TECLA AI no funcionan en producción. Bloqueante.
2. **Redesplegar la versión actual** (Modo conducción, TECLA AI solo voz, orbe, Drive v3, Spotify) y verificar en el carro: GPS con velocidad y rumbo, micrófono, rendimiento del canvas, DRM de Spotify.
3. **Vincular Spotify Premium** y probar reproducción en pantalla.

## Fase B — Conducir escuchando (la experiencia principal en marcha, 1 semana)

4. **Modo conducción automático**: cuando Drive detecte velocidad por GPS, el reproductor de YouTube pasa solo a carátula y controles; al estacionar vuelve al video. Sin tocar la pantalla.
5. **Cola por voz**: «pon tres canciones de…», «siguiente», «repite», «guarda esta» con Jarvis; cola visible en el HUD de voz.
6. **Resúmenes hablados**: «¿de qué trata este video?» leído por Jarvis con los metadatos reales; «lee los titulares» con fuentes RSS autorizadas.
7. **Podcasts y audiolibros completos**: hoy solo suena el avance de iTunes; integrar un proveedor con episodios completos (RSS del podcast) para viajes largos.
8. **Radio inteligente**: «pon una emisora de vallenato de Sincelejo», favoritos por voz, continuar donde quedó.

## Fase C — TECLA AI más Jarvis (1–2 semanas)

9. **Streaming de texto y voz**: respuesta que empieza a sonar en menos de un segundo (DeepSeek `stream` + ElevenLabs por WebSocket). Es lo que más acerca la sensación Jarvis.
10. **Voz Jarvis propia**: elegir o clonar una voz grave y pausada en ElevenLabs (con licencia) y fijarla como predeterminada.
11. **Palabra de activación opcional** («Oye TECLA») solo con consentimiento explícito, indicador visible y procesamiento local; se apaga sola al salir de la app.
12. **Rutina de arranque**: al abrir la app en el carro, Jarvis saluda con hora, clima real y lo que quedó pendiente (video a medias, cola), con límite de costo.
13. **Memoria útil**: recordar motores de Drive favoritos, emisoras, artistas y horarios, siempre con consentimiento y borrable.

## Fase D — Drive (1 semana)

14. Prueba real en el carro y ajuste de umbrales (retención de velocidad, curvatura por rumbo, estacionado).
15. Escenas nuevas de temporada (Navidad, lluvia nocturna, ciudad de día) y clima real dibujado (lluvia, niebla por humedad).
16. Sonido de aviso al cambiar de marcha manual y limitador más realista; «modo silencioso» para parqueaderos.
17. Rendimiento medido en el Tesla (fps y consumo) y ajuste automático del detalle.

## Fase E — Pasajeros y hogar (2 semanas)

18. **Modo pasajero en el teléfono**: la misma cuenta en el celular del acompañante; el video completo va al teléfono, el audio al carro. Es la forma legítima de ver video con el carro en marcha.
19. **Listas compartidas**: lo que el pasajero añade desde el teléfono aparece en la cola del carro.
20. **Cuenta y sincronización**: borrado de cuenta, dispositivos vinculados, exportación.

## Fase F — Calidad y operación (continuo)

21. Rate limit distribuido (PostgreSQL/Redis) para varias réplicas.
22. Migración a Prisma 7 para cerrar los avisos de auditoría.
23. Pruebas E2E en Tesla real documentadas con capturas; telemetría mínima de errores sin datos personales.

## Qué no entra

- Reproducir video en la pantalla central con el carro en marcha, por cualquier técnica (canvas, WebGL, proxy). Es un rodeo a un bloqueo de seguridad y es ilegal en la mayoría de países.
- Capturar audio o transcripciones sin consentimiento, o enviar ubicación a servidores.

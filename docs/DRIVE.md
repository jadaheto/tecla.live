# TECLA DRIVE

Experiencia de sonido de motor y paisaje integrada en TECLA LIVE, pensada para disfrutar estacionado o como acompañamiento visual/sonoro del viaje. Todo el contenido es original: las escenas se dibujan con Canvas 2D, el sonido se sintetiza con Web Audio y los motores se nombran por su arquitectura (V8, bóxer, rotativo, EV…), **sin marcas ni modelos comerciales** y sin afiliación con productos de terceros.

![TECLA DRIVE](assets/drive.png)

## Flujo en el Tesla (v3)

1. Al abrir `/drive` aparece una pantalla de arranque con un solo botón grande: **Tocar para encender**. Ese único gesto crea el audio, activa el GPS, entra en pantalla completa, pide *wake lock* y pone la app en modo cine (se restaura al salir). Ningún navegador permite iniciar audio sin un gesto; por eso no existe un arranque sin toque.
2. Todo se controla por GPS: velocidad, marchas, rpm, y la carretera **curva hacia donde giras** usando el rumbo del GPS. Si la señal se pierde, la velocidad se mantiene 4 s y luego baja en 8 s; el HUD indica «sin señal» y la calidad (buena/regular/débil).
3. El HUD se oculta tras 6 s sin tocar la pantalla; un toque lo trae de vuelta. El velocímetro siempre queda visible.
4. **Sonidos y escenas** es un icono pequeño arriba a la derecha; el panel se abre como capa sobre la escena sin empujar la pantalla.
5. **REV** solo aparece detenido (semáforo). Paseo automático, arrancada 0–100 y pedales viven en **Modo demo (sin GPS)**, que se activa desde la pantalla de arranque o el panel.
6. **Escena automática** por hora y clima real (Open-Meteo): noche de octubre → Halloween, tormenta → Halloween/Cañón, niebla o nieve → Aurora/Alpes, lluvia → Neón/Alpes, amanecer → Costa, tarde → Cañón, atardecer → Neón. Elegir una escena a mano la fija.
7. **Estacionado** más de 2 minutos: el motor baja al 45 % del volumen; al moverse vuelve.
8. **Modo rendimiento** (automático si el navegador es el del Tesla): DPR 1 y la mitad de objetos y partículas.
9. **Audio en AudioWorklet** (`public/drive/engine-worklet.js`): la síntesis corre en el hilo de audio; si el navegador no lo soporta, cae a `ScriptProcessorNode` con la misma física (`engine-synth.ts`). Una prueba unitaria comprueba que ambos producen las mismas muestras.
10. **TECLA AI**: «pon el V12», «escena neón», «apaga el motor» usan `drive_control`. Drive se registra como reproductor: mientras TECLA AI habla, el motor se atenúa y luego vuelve.

## Fase D implementada (2026-10-21)

- **Escenas nuevas**: Navidad (pueblo nevado, cabañas, guirnaldas de luces), Ciudad lluviosa (asfalto mojado, ventanas encendidas) y Ciudad de día. La escena automática usa diciembre → Navidad, lluvia de noche → Ciudad lluviosa, nublado de día → Ciudad de día.
- **Clima real dibujado** sobre cualquier escena con carretera: lluvia o llovizna (gotas y asfalto mojado), niebla y nieve, según Open-Meteo.
- **Sonido de cambio de marcha** (golpe seco) en cambios manuales y automáticos, además de los petardeos.
- **Modo silencioso** (volumen al 25 %) para parqueaderos y zonas residenciales.
- **Detalle automático**: si los fps caen por debajo de 38 durante 3 s, el lienzo baja a DPR 1 y menos objetos por sí solo; el chip de Modo rendimiento lo indica.
- Pendiente de hardware: ajustar umbrales de GPS y rendimiento con el carro real.

## Qué incluye

- Ruta `/drive`, accesible desde la navegación principal, los accesos rápidos y la sección **Experiencias** de `/apps`.
- **Carretera pseudo-3D** con curvas, colinas, objetos con profundidad, tráfico de frente y en el mismo sentido, niebla, partículas y faros propios.
- **10 escenarios**: Halloween (castillo, calabazas, fantasmas, zombis, bruja y relámpagos), Neón (synthwave con ciudad y rejilla), Cañón, Costa (mar animado, faro, veleros), Alpes (nieve, cabañas, ciervos), Aurora, Galaxia, Estrellas (warp), Plaid (túnel arcoíris) y Portal.
- **26 motores sintetizados** en cuatro familias: exóticos V10/V12, V8 y compresor, turbo/rotativo/rally, y EV/sci-fi/terror. Cada motor tiene ralentí, corte, cilindros, resonadores de escape, turbo/compresor, petardeos y flutter propios.
- **Estudio de sonido**: turbo/compresor, petardeos, resonancia, tono, cabeceo en ralentí y volumen. Se guarda en el navegador.
- **Velocímetro** de 0 a 240 km/h (o mph) con arco de rpm, marcha y modo; barra de rpm y nombre del motor en el HUD.
- **Modos de conducción**:
  - **Encender motor**: ralentí con cabeceo irregular.
  - **REV** (mantener): acelerar en vacío hasta el corte, con petardeos al soltar.
  - **Acelerar / Frenar** (mantener): pedales táctiles sobre la simulación estacionaria.
  - **Arrancada 0–100**: lanzamiento con cambios automáticos que termina en paseo.
  - **Paseo automático**: acelera en rectas, frena en curvas y cruza tráfico.
  - **GPS real**: la velocidad, el paisaje y el motor siguen la velocidad del navegador (opcional).
- **Transmisión**: siete marchas automáticas o manuales (−/+), limitador de revoluciones y modo «D» para motores eléctricos.
- Favoritos de motor, unidades (km/h o mph), escena, motor y estudio persistidos localmente (`tecla-drive-v1`).
- Pantalla completa, silencio, parada segura al ocultar la pestaña y diseño táctil sin hover obligatorio.

## Privacidad y seguridad

- **GPS opcional:** solo se activa al pulsar **Activar GPS**. La ubicación se procesa en el navegador y no se envía ni se guarda. Requiere HTTPS.
- **Sin audio hasta un gesto:** el `AudioContext` se crea al pulsar Encender motor, REV, Acelerar, Arrancada, Paseo o Activar GPS.
- **Sin descargas:** no hay samples, imágenes ni fuentes externas; la carga de grabaciones reales por URL del prototipo original se dejó fuera a propósito (archivos arbitrarios y selector de archivos no tienen sentido en el navegador del Tesla).
- No controla el vehículo ni la bocina de peatones. La UI recuerda no manipular la pantalla mientras se conduce.
- No se solicita micrófono ni cámara.

## Implementación

- `src/features/drive/drive-config.ts`: catálogo de escenas, motores, categorías, estudio y funciones puras (unidades, filtros, normalización de rpm).
- `src/features/drive/engine-model.ts`: transmisión y modos (`idle`, `rev`, `launch`, `cruise`, `gps`) como función pura `stepDrive` con eventos de petardeo.
- `src/features/drive/engine-synth.ts`: síntesis física por tipo de motor (clase pura, probada en Node).
- `src/features/drive/audio-engine.ts`: grafo Web Audio (procesador, resonadores, tubo de escape con realimentación, viento, compresor) y efectos de válvula de descarga/petardeos.
- `src/features/drive/scene-renderer.ts`: geometría de carretera, sprites, tráfico, fondos y las 10 escenas.
- `src/features/drive/drive-canvas.tsx`: lienzo con `ResizeObserver`, DPR ≤ 1.5 y pausa al ocultar la pestaña.
- `src/features/drive/use-drive-engine.ts`: bucle `requestAnimationFrame` que une simulación, audio y lienzo; publica estado a la UI a ~15 Hz.
- `src/features/drive/drive-experience.tsx`: HUD, controles táctiles, panel de sonidos y escenas, estudio.
- `src/features/drive/drive-geolocation.ts`: `watchPosition`, velocidad reportada o derivada por Haversine, permisos y errores.
- `src/stores/drive.ts`: preferencias persistidas de TECLA DRIVE.

## Restricciones

- La síntesis corre en `AudioWorklet`; el respaldo `ScriptProcessorNode` solo se usa si el navegador no lo ofrece.
- El GPS del navegador del Tesla no está verificado con hardware; si no lo entrega, queda el modo demo.
- La calidad percibida depende de los altavoces, del volumen del navegador y de las políticas de autoplay del vehículo.
- Algunos navegadores suspenden el audio al cambiar de pestaña; la experiencia se detiene de forma segura.
- El GPS requiere un contexto seguro (HTTPS). En `tecla.live` hay que corregir el certificado autofirmado.
- `prefers-reduced-motion` desactiva la vibración de cámara y los relámpagos.

## Verificación

- `npm run typecheck`, `npm run lint` y `npm run test:run` (pruebas de catálogo, transmisión, modos, pedales, síntesis por tipo de motor y GPS).
- Playwright: arranque de un toque, modo demo, panel de sonidos y escenas, cambio de escena y motor, paseo automático, apagado y GPS con geolocalización simulada.
- La prueba con GPS físico y el navegador del Tesla sigue pendiente de hardware.

![TECLA DRIVE en móvil](assets/drive-mobile.png)

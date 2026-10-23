# TECLA AI — análisis y modo Jarvis

Fecha: 2026-10-20. Revisión completa del subsistema de inteligencia artificial de TECLA LIVE y de lo que falta para que se sienta como un asistente de a bordo «estilo Jarvis».

## Cómo está construido hoy

| Capa | Archivo | Qué hace |
| --- | --- | --- |
| Orquestación | `src/lib/ai/orchestration/chat.ts` | Bucle de function calling con DeepSeek: máximo de pasos, validación Zod de cada llamada, herramientas de servidor ejecutadas en el acto y herramientas de cliente devueltas como `pendingActions`. |
| Prompt | `src/lib/ai/prompts/system.ts` | Contexto de pantalla, reproductor, capacidades, memoria consentida, reglas de honestidad y seguridad. |
| Herramientas | `src/features/ai/tools/schemas.ts`, `src/lib/ai/tools/registry.ts` | 24 herramientas tipadas (antes 21): YouTube, radio, podcasts, clima, apps, navegación, tema, estilo visual, modo de pantalla, pantalla completa, favoritos, memoria, Spotify. |
| Puente de acciones | `src/features/ai/hooks/use-tecla-actions.ts` | El navegador ejecuta las acciones de cliente y devuelve el resultado real antes de que el modelo anuncie éxito. |
| Voz | `src/app/api/ai/stt`, `src/app/api/ai/tts`, `src/features/ai/hooks/use-tecla-ai.ts` | Push-to-talk → Deepgram → DeepSeek → ElevenLabs; interrupción, modo conversación, pausa de reproductores. |
| Límites | `src/lib/ai/usage/ledger.ts`, `src/lib/rate-limit.ts` | Rate limit por IP/sesión, presupuesto mensual, ledger por proveedor. |

Fortalezas: el modelo nunca anuncia acciones sin resultado real, las claves viven en el servidor, las URLs y apps están en lista blanca, y la memoria requiere consentimiento. Eso es exactamente la base que un «Jarvis» necesita para ser confiable.

## Qué le faltaba para sentirse como Jarvis

1. **Personalidad.** El prompt pedía un copiloto «cercano y de tú». Jarvis es sereno, formal, con ingenio seco, confirma con frases cortas y entrega reportes de estado.
2. **Anticipación.** No sugería el siguiente paso tras cumplir una orden.
3. **Saludo de sistema.** El panel abría con «¿Qué quieres disfrutar hoy?»; no había sensación de «sistemas en línea».
4. **Control real de música.** Spotify solo tenía play/pausa/siguiente/volumen sobre un dispositivo externo. «Pon tal canción» no era posible sin el celular.
5. **Palabra de activación y escucha continua.** No existen; la voz es push-to-talk (decisión de privacidad y de costo).
6. **Respuesta en streaming.** El texto llega completo al final; la voz se sintetiza después.

## Qué se implementó en esta iteración

- **Persona configurable** (`aiPersona`: `jarvis` por defecto o `copiloto`) en Ajustes → TECLA AI. El prompt del sistema cambia de bloque de personalidad: trato de «señor» o por nombre, confirmaciones breves («Hecho, señor.»), reportes de estado y una sugerencia máxima de anticipación.
- **Saludo de sistema** en el panel vacío: «Sistemas en línea · A sus órdenes, señor.»
- **Spotify de verdad:** herramientas `search_spotify` y `play_spotify` (servidor), rutas `/api/spotify/search`, `/api/spotify/devices`, `/api/spotify/token`, y reproducción por URI en `/api/spotify/control`. El reproductor web oficial de Spotify (Web Playback SDK) convierte el navegador en un dispositivo «TECLA LIVE», así que la canción suena en la pantalla sin abrir el celular. TECLA AI recibe el `device_id` del reproductor web y reproduce ahí.
- **Estilo visual por voz:** `set_visual_style` («activa el estilo Cyberpunk 2077», «vuelve al estilo normal»).
- El prompt informa al modelo del estilo activo y de si el reproductor web de Spotify está encendido, para que responda con precisión.

## Manos libres (2026-10-20, tarde)

- **Escuchar al abrir** (`aiAutoListen`, activado por defecto): al tocar el botón TECLA AI, el micrófono se enciende de inmediato con ese mismo gesto; no hay que escribir ni tocar el micrófono.
- **Fin de frase automático**: un analizador de nivel detecta cuándo terminas de hablar (1,4 s de silencio tras voz) y envía la orden sola; si no hay voz en 8 s, se descarta. El botón de detener sigue disponible.
- Con **Modo conversación** activado, TECLA AI vuelve a escuchar al terminar de responder, así se pueden pedir canciones seguidas sin tocar la pantalla.
- La primera vez pide el consentimiento del micrófono; después se recuerda. El micrófono se libera al terminar cada orden y no se guarda audio.
- Pendiente de hardware: comprobar que el navegador del Tesla entrega micrófono (`getUserMedia`); requiere HTTPS válido.

## Modo solo voz (HUD) — 2026-10-20, noche

- Con «Escuchar al abrir» activo, el botón TECLA AI (cabecera, barra móvil, lanzador flotante, ⌘J y el micrófono del HUD de Drive) abre un **HUD flotante de voz** en lugar del panel de chat: orbe, estado («Le escucho, señor», «Procesando…»), lo que entendió y una respuesta corta. Sin teclado. Se cierra solo 4 s después de responder (6 s si hubo error); con Modo conversación sigue escuchando. El botón del teclado abre el panel de texto cuando haga falta.
- La orden `play_youtube` ahora espera hasta 4,5 s el resultado real del reproductor y devuelve `playing` o `autoplayBlocked`; el prompt prohíbe la advertencia genérica de autoplay y pide una sola frase cuando la orden llegó por voz. Así desaparece el «Si el navegador retuvo el autoplay…» en cada respuesta.
- El HUD es global: si la orden navega a un video, el HUD sigue visible sobre el reproductor y se cierra solo.

## Orbe fluido (estilo asistente de voz)

`src/components/ai/siri-orb.tsx` dibuja en Canvas 2D cuatro masas de color (acento, violeta, aqua y blanco) mezcladas con `screen` y desenfoque, dentro de un núcleo circular con brillo y un anillo. Estados: en reposo respira lento; al escuchar se agita con el **nivel real del micrófono**; al pensar gira el anillo como progreso; al responder late con la **voz sintetizada** (analizador sobre el `<audio>` de ElevenLabs, solo si el `AudioContext` está corriendo para no silenciar la voz); en error vira a rojo. Los colores salen de las variables CSS, así que con el estilo Cyberpunk 2077 cambia a amarillo y cian. Respeta `prefers-reduced-motion`. El nivel viaja por `src/features/ai/voice-level.ts` sin pasar por React.

## Fase C implementada (2026-10-21)

- **Streaming de texto y voz**: `/api/ai/chat` responde en SSE cuando el cliente pide `text/event-stream` (`delta` con texto parcial, `done` con la respuesta completa, `error`). DeepSeek se consume con `stream: true` y las llamadas a herramientas se reconstruyen por índice. En el cliente, el texto aparece a medida que llega y, si la orden fue por voz, cada frase completa se convierte en voz y se reproduce en orden: la primera frase suena antes de que termine la respuesta. El JSON no streaming sigue disponible (lo usan las pruebas).
- **Palabra de activación «Oye TECLA»** (`wakeWordEnabled`, apagada por defecto): usa el reconocimiento de voz del navegador (`webkitSpeechRecognition`) en continuo buscando solo esa frase, con indicador visible, pausa mientras TECLA AI escucha o habla y apagado al ocultar la pestaña. El audio no pasa por servidores de TECLA LIVE. En el navegador del Tesla puede no estar disponible; el indicador lo dice.
- **Diagnóstico de «Oye TECLA» (2026-10-21):** corregido un fallo por el que, tras pasar la pestaña a segundo plano, el reconocimiento no volvía a arrancar. Ahora se reinicia tras `end`, `no-speech`, `network` y al volver a primer plano; el indicador muestra lo último que oyó para depurar. Prueba unitaria en jsdom con un reconocedor falso: la frase abre el HUD, otras frases no, y se pausa mientras TECLA AI está abierto. Requisitos para que funcione: estar dentro de la app con la pestaña visible, TECLA AI cerrado, micrófono permitido e internet (Chrome usa el servicio de Google para reconocer). En el navegador del Tesla no está garantizado.
- **Despedidas por voz** (`farewell.ts`): «gracias», «no, gracias», «adiós», «eso es todo», «listo», «ciérrate», «buenas noches»… se resuelven localmente: Jarvis responde una frase breve («A sus órdenes, señor. Quedo disponible.») y el HUD se cierra al terminar de hablar, sin volver a escuchar ni llamar a DeepSeek. Solo frases cortas y completas, para no confundir «gracias a la vida» con una despedida. Además, si la escucha la abrió el modo conversación y no hay voz en 8 s, el HUD se cierra en silencio en lugar de mostrar «No escuché nada».
- **Rutina de arranque** (`speakGreeting`): la primera vez que se abre TECLA AI por voz en la sesión, Jarvis saluda con la hora, el clima real y el video que quedó a medias, y luego escucha. El texto se construye localmente (`greeting.ts`); solo cuesta una síntesis de voz.
- **Memoria útil**: `remember_preference` acepta ahora motor, escena, podcast, artista y horario, siempre con consentimiento.
- **Voz Jarvis propia**: no se puede elegir desde aquí; en Ajustes → TECLA AI → Voz autorizada aparecen las voces de tu cuenta de ElevenLabs. Elige una grave y pausada y queda fijada.

## Identidad y voces (2026-10-21)

- **Identidad** (`src/lib/ai/identity.ts`): el asistente se llama «TECLA» por defecto y el usuario puede renombrarlo en Ajustes → TECLA AI → Nombre del asistente (por ejemplo «Jarvis»). El prompt incluye un bloque de identidad: nombre, función (sistema de a bordo de TECLA LIVE, creado en Colombia), cómo presentarse, qué decir sobre los modelos que lo impulsan y sus principios (no distraer, no inventar, privacidad, no eludir restricciones del vehículo). El nombre aparece en el panel y en el HUD, y «Oye <nombre>» también despierta al asistente.
- **Voces curadas por entorno (2026-10-21):** la lista se define en `ELEVENLABS_VOICES` (`id|Nombre|grupo|género;…`, ver `.env.example`), el endpoint público `/api/ai/voices/public` la expone sin sesión y Ajustes la muestra a cualquier usuario: nadie necesita cuenta de ElevenLabs. Si la variable no existe, se usa una lista de respaldo en código.
- **Voces curadas** (`src/lib/ai/elevenlabs/curated-voices.ts`): la voz del `.env` (Valeria, español latino, femenina) sigue siendo la predeterminada. En Ajustes se ofrecen además, en grupos: Español latino · Colombia (Alejandro, Alberto, Andrea de Medellín, Valentina de Medellín), Hombres populares (Brian, George, Daniel) y Mujeres populares (Sarah, Alice, Matilda), más cualquier otra voz de la cuenta. Los IDs son públicos; la clave sigue en el servidor y `/api/ai/tts` solo acepta voces curadas o de la cuenta. El modelo `eleven_flash_v2_5` es multilingüe: las voces en inglés hablan español con acento; para Jarvis en español se recomienda Alberto o Alejandro.

## Estilo «Roadster» (2026-10-23)

- Inspirado en la interfaz del Tesla Roadster («inspired by fighter jet cockpits»), a partir de las capturas que aportó el usuario (no se incluyen en el repo: `roadster/` está en `.gitignore`). Rasgos tomados: negro puro, rojo monocromo `#ff2b2b` en texto, líneas y bordes, paneles con tinte rojo y borde fino, rejilla de puntos en perspectiva, rombos como marcadores, mayúsculas espaciadas y lecturas tipo display.
- CSS `[data-style="roadster"]` en `globals.css`: Montserrat (`--font-roadster`) para la interfaz y Share Tech Mono para lecturas; esquinas casi rectas (6 px) salvo interruptores; imágenes ligeramente desaturadas; rejilla con `perspective()` en `.ambient-shell::before`.
- `src/components/roadster/roadster-hud.tsx`: regla de cabina bajo la cabecera (marcas de escala y rombo central). `roadster-reticle.tsx`: retícula de radar en canvas para el HUD de voz (anillos, marcas, barrido giratorio y rombo que crece con la voz).
- Personalidad «piloto» (`effectivePersona`): copiloto de vuelo que trata al usuario de «piloto», confirma como lista de comprobación («Confirmado.», «En curso.», «Negativo: …») y saluda con «Cabina lista, sistemas nominales». Se activa por el estilo; por voz: «modo roadster» o «modo cabina».

## Grabación de voz en el carro (2026-10-21)

- Cada `MediaRecorder` guarda sus fragmentos en una lista propia (`use-tecla-ai.ts`). Antes una lista compartida mezclaba el final de una grabación con el inicio de la siguiente y Deepgram respondía 400 «corrupt or unsupported data» sobre un WebM sin cabecera.
- Detección de fin de frase con piso de ruido adaptativo: el umbral de voz es `max(0,02, piso × 2,5)`, donde el piso sigue el mínimo reciente del RMS y sube despacio (tope 0,12). Así el ruido de rodadura no cuenta como voz y el silencio de 1,4 s se detecta en marcha.
- La ruta `/api/ai/stt` registra el motivo de Deepgram (`providerCode`, `providerMessage`, mime y bytes) y responde 422 `AUDIO_NOT_UNDERSTOOD` reintentable ante un 400.

## Estilo «El auto fantástico» (KITT) y «Oye TECLA» en el Tesla (2026-10-21)

- **Estilo visual `kitt`** (`[data-style="kitt"]` en `globals.css`): fondo negro, acento rojo escáner `#ff1a1a`, ámbar `#ffb000`, títulos en Orbitron y texto en Share Tech Mono (`next/font/google`, variables `--font-kitt` y `--font-kitt-mono`). Fuerza el tema oscuro como Cyberpunk. Referencias tomadas de la serie: Pontiac Trans Am negro de 1982, escáner frontal rojo con barrido Larson, tablero de LED rojos/ámbar y el modulador de voz de tres columnas.
- **Escáner** (`src/components/kitt/kitt-scanner.tsx`): barra de 6 px bajo la cabecera con la luz roja y su estela (`@keyframes kitt-scan`); más lento con `reduce-motion`.
- **Modulador de voz** (`src/components/kitt/kitt-voice-box.tsx`): sustituye al orbe Siri en el HUD de voz; tres columnas de 9 LED que se encienden desde el centro con el nivel del micrófono (ámbar) o de la voz sintetizada (rojo), leyendo `getVoiceLevel()` por cuadro sin pasar por React.
- **Personalidad KITT** (`src/features/ai/persona.ts`, `effectivePersona`): el estilo activa la persona `kitt` por encima de la elegida en Ajustes: bloque propio en el prompt del sistema, saludo («Escáner activo y sistemas en línea… ¿Adónde vamos hoy, señor?»), despedidas y etiquetas del HUD. «Oye KITT» también despierta al asistente con este estilo.
- **Voz**: si el usuario no eligió voz, con el estilo activo se usa `ELEVENLABS_KITT_VOICE_ID` o, si falta, la primera voz masculina grave de `ELEVENLABS_VOICES` (Alberto por defecto). El servidor la expone en `/api/ai/voices/public` como `kittVoiceId`; el cliente la precarga al activar el estilo (`src/features/ai/kitt-voice.ts`).
- **«Oye TECLA» en el Tesla** (`src/components/ai/wake-word-listener.tsx` + `src/features/ai/wake-word.ts`): revisa las 3 alternativas del reconocedor; normaliza acentos y tolera variantes fonéticas («tekla», «tesla», «te cla», «olle tecla») y un error de una letra; reinicia con espera creciente (0,7 s → 30 s) ante errores `network`/`audio-capture` y lo indica («reconectando», «sin servicio de voz»); un vigilante reinicia el reconocedor si pasa 45 s mudo; si el permiso de micrófono se negó, el chip se vuelve un botón «Toca para activar» que vuelve a pedir el micrófono con un gesto; idioma con respaldo `es-CO` → `es-419` → `es-ES`. Límite real: el navegador del Tesla debe traer `webkitSpeechRecognition` con servicio de Google; si no lo trae, el chip lo dice y la activación es por toque.

## Reproducción de fondo (2026-10-21)

- La radio (`src/features/radio/radio-audio.ts`) y el reproductor web de Spotify (`src/features/music/spotify-web-player-bridge.ts`) son instancias únicas fuera de React: siguen sonando al navegar a Inicio, Drive o Ajustes. La barra flotante (`src/components/media/mini-player.tsx`) muestra portada, título, reproducir/pausar, siguiente (Spotify) y cerrar; se oculta en la página de su propia fuente, en `/ai` y en `/drive` (el audio continúa).
- Árbitro (`src/features/media/playback-sources.ts`): una sola fuente a la vez. Si el usuario pone YouTube, un podcast, IPTV o la otra fuente, la anterior se pausa; cerrar la barra la detiene. El motor de TECLA Drive se mezcla con la música, no la pausa.
- Controlador de medios en dos niveles (`player-bridge.ts`): la pantalla montada registra el suyo; la fuente de fondo registra otro. `pausa`/`reanuda`/`siguiente` de TECLA AI y el ducking durante la voz actúan sobre la música de fondo cuando está sonando, incluso en Drive.
- Límite: si Spotify se reproduce en el celular (no en el dispositivo web), la app pausa la radio al pedir la canción, pero no muestra barra ni controles locales para ese dispositivo.

## Radio por voz y costo de «Oye TECLA» (2026-10-21)

- **«Oye TECLA» no consume tokens de ninguna IA de pago.** Usa el reconocimiento de voz integrado en Chrome (servicio de Google, sin costo para TECLA LIVE); no pasa por Deepgram, DeepSeek ni ElevenLabs. Deepgram solo se usa cuando el HUD de voz está grabando una orden; DeepSeek solo al enviarla; ElevenLabs solo al responder. Sí oye lo que suene en la cabina (la radio incluida): eso no cuesta nada, pero se retiró el texto en pantalla de lo que oye, que era solo de depuración.
- **Emisora por voz sin tocar la pantalla**: `play_radio` abre `/radio?station=…&autoplay=1`; la página arranca la emisora al cargar y el puente espera hasta 6 s el estado real (sonando o autoplay bloqueado) para que Jarvis responda con precisión.

## Requisitos y límites reales

- `play_spotify` requiere sesión en TECLA LIVE, cuenta de Spotify vinculada con el permiso nuevo `streaming` (hay que **volver a vincular** las cuentas ya conectadas) y Spotify Premium.
- Reproducir en la pantalla depende de que el navegador tenga DRM (Widevine). En el navegador del Tesla no está verificado; si falla, el reproductor lo informa y se puede reproducir en otro dispositivo activo.
- La palabra de activación («Oye TECLA») sigue sin implementarse: exigiría micrófono abierto permanente. Se mantiene el push-to-talk y el modo conversación opcional.
- Sin streaming de tokens ni de voz; es una mejora futura (DeepSeek soporta `stream`, ElevenLabs soporta streaming por WebSocket).

## Próximos pasos recomendados

1. Voz «Jarvis»: elegir en Ajustes una voz de ElevenLabs grave y pausada; opcionalmente clonar una voz propia con licencia.
2. Streaming de texto y de voz para reducir la latencia percibida.
3. Reportes proactivos opt-in (clima al abrir, estado de Spotify) con un límite de costo claro.
4. Palabra de activación local (Web Speech o modelo en el navegador) solo con consentimiento y con indicador visible.

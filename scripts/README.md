# Scripts de desarrollo

Estos scripts no se incluyen en la imagen Docker (ver `.dockerignore`).

- `capture-docs.mjs` — captura las imágenes de `docs/assets` desde el servidor local.
- `visual-check.mjs` — recorre las rutas principales a 1920×1080 y registra errores de consola.
- `mock-deepseek.mjs` — **solo pruebas locales**: emula el endpoint de DeepSeek en el puerto 5555 para validar el protocolo de function calling sin gastar crédito. No es un sustituto de producción; la integración real queda pendiente de `DEEPSEEK_API_KEY`.

Para probar el function calling sin proveedor real:

```bash
node scripts/mock-deepseek.mjs        # terminal 1
PORT=3100 DEEPSEEK_API_KEY=test-key \
  DEEPSEEK_BASE_URL=http://127.0.0.1:5555 npm run start   # terminal 2
# POST /api/ai/chat con una orden de clima o tema
```

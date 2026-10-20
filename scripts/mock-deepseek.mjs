// Servidor local SOLO para pruebas de integración. No es un proveedor real.
import http from 'node:http';

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/chat/completions') {
    res.writeHead(404).end('not found');
    return;
  }
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    try {
      const body = JSON.parse(raw);
      const toolMessages = (body.messages ?? []).filter((m) => m.role === 'tool');
      const lastUser = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user');
      let message;
      if (toolMessages.length > 0) {
        const lastTool = toolMessages[toolMessages.length - 1];
        message = {
          role: 'assistant',
          content: `Integración de prueba completada. Resultado de la herramienta: ${String(lastTool.content).slice(0, 180)}`,
        };
      } else if (/tema|oscuro/i.test(String(lastUser?.content ?? ''))) {
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{ id: 'call_theme', type: 'function', function: { name: 'set_theme', arguments: '{"theme":"dark"}' } }],
        };
      } else if (/clima|tiempo|temperatura/i.test(String(lastUser?.content ?? ''))) {
        message = {
          role: 'assistant',
          content: '',
          tool_calls: [{ id: 'call_weather', type: 'function', function: { name: 'get_weather', arguments: '{"location":"Sincelejo"}' } }],
        };
      } else {
        message = { role: 'assistant', content: 'Hola desde el mock de pruebas.' };
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'mock-completion',
        choices: [{ message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }],
        usage: { prompt_tokens: 120, completion_tokens: 30 },
      }));
    } catch (error) {
      res.writeHead(500).end(String(error));
    }
  });
});
server.listen(5555, '127.0.0.1', () => console.log('mock deepseek on 5555'));

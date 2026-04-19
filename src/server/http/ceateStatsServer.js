import http from 'node:http';

export function createStatsServer({ connectionRegistry, messageStore, logger }) {
  const server = http.createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/stats') {
      const body = JSON.stringify({
        generatedAt: new Date().toISOString(),
        ...connectionRegistry.getStats(),
        ...messageStore.getStats(),
      }, null, 2);

      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(body);
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Not found' }));
  });

  server.on('error', (error) => {
    logger.error('HTTP stats server error.', error);
  });

  return server;
}

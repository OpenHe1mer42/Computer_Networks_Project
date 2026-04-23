import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');

const staticFiles = new Map([
  ['/', { file: 'index.html', contentType: 'text/html; charset=utf-8' }],
  ['/index.html', { file: 'index.html', contentType: 'text/html; charset=utf-8' }],
  ['/styles.css', { file: 'styles.css', contentType: 'text/css; charset=utf-8' }],
  ['/dashboard.js', { file: 'dashboard.js', contentType: 'text/javascript; charset=utf-8' }],
]);

export function createStatsServer({ connectionRegistry, messageStore, logger }) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

    if (request.method === 'GET' && url.pathname === '/stats') {
      const body = JSON.stringify({
        generatedAt: new Date().toISOString(),
        ...connectionRegistry.getStats(),
        ...messageStore.getStats(),
      }, null, 2);

      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(body);
      return;
    }

    const staticFile = ['GET', 'HEAD'].includes(request.method)
      ? staticFiles.get(url.pathname)
      : null;

    if (staticFile) {
      try {
        const body = await fs.readFile(path.join(publicDir, staticFile.file));
        response.writeHead(200, {
          'content-type': staticFile.contentType,
          'cache-control': 'no-store',
        });
        response.end(request.method === 'HEAD' ? undefined : body);
        return;
      } catch (error) {
        logger.error('Failed to serve HTTP dashboard asset.', {
          path: url.pathname,
          error,
        });
        response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: 'Failed to load dashboard asset' }));
        return;
      }
    }

    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Not found' }));
  });

  server.on('error', (error) => {
    logger.error('HTTP stats server error.', error);
  });

  return server;
}

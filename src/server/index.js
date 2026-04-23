import { config } from '../config/env.js';
import { createServerApp } from './app.js';
import { createServerTerminal } from './cli/serverTerminal.js';

const serverTerminal = createServerTerminal({
  interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
});

serverTerminal.printStartupBanner();

const app = await createServerApp(config, { serverTerminal });
await app.start();
serverTerminal.startClock();

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  app.logger.info('Shutting down server.', { signal });
  await app.stop();
  serverTerminal.stopClock();
  process.exit(0);
}

process.on('exit', () => {
  serverTerminal.stopClock();
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

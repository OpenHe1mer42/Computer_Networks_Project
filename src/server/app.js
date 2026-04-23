import fs from 'node:fs/promises';
import path from 'node:path';

import { createLogger } from '../shared/logger.js';
import { createStatsServer } from './http/createStatsServer.js';
import { createTcpServer } from './transport/tcpServer.js';
import { CommandService } from './services/commandService.js';
import { ConnectionRegistry } from './services/connectionRegistry.js';
import { FileService } from './services/fileService.js';
import { MessageStore } from './services/messageStore.js';

function listen(server, { host, port }) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };

    const onListening = () => {
      server.off('error', onError);
      resolve();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export async function createServerApp(config, { serverTerminal } = {}) {
  await fs.mkdir(config.storage.serverFilesDir, { recursive: true });
  await fs.mkdir(path.dirname(config.storage.serverLogFile), { recursive: true });
  await fs.mkdir(path.dirname(config.storage.messageLogFile), { recursive: true });

  const logger = createLogger({
    name: 'server',
    logFile: config.storage.serverLogFile,
    consoleOutput: !serverTerminal?.interactive,
    onEntry: (entry) => serverTerminal?.addLogEntry(entry),
  });

  const connectionRegistry = new ConnectionRegistry();
  serverTerminal?.setStatsProvider(() => connectionRegistry.getStats());
  const messageStore = new MessageStore({
    messageLogFile: config.storage.messageLogFile,
    recentLimit: config.stats.recentMessageLimit,
  });
  const fileService = new FileService({
    baseDir: config.storage.serverFilesDir,
  });
  const commandService = new CommandService({
    fileService,
    readOnlyResponseDelayMs: config.behavior.readOnlyResponseDelayMs,
  });

  await fileService.init();

  const tcpServer = createTcpServer({
    socketConfig: config.socket,
    authConfig: config.auth,
    connectionRegistry,
    messageStore,
    commandService,
    logger,
  });
  const statsServer = createStatsServer({
    connectionRegistry,
    messageStore,
    logger,
  });

  return {
    logger,
    async start() {
      await listen(tcpServer, {
        host: config.socket.host,
        port: config.socket.port,
      });
      serverTerminal?.setServiceStatus('tcp', `${config.socket.host}:${config.socket.port}`);
      logger.info('TCP server listening.', {
        host: config.socket.host,
        port: config.socket.port,
      });

      await listen(statsServer, {
        host: config.http.host,
        port: config.http.port,
      });
      serverTerminal?.setServiceStatus('http', `${config.http.host}:${config.http.port}`);
      logger.info('HTTP stats server listening.', {
        host: config.http.host,
        port: config.http.port,
      });
    },
    async stop() {
      serverTerminal?.setServiceStatus('http', 'stopping');
      await close(statsServer);
      serverTerminal?.setServiceStatus('tcp', 'stopping');
      await close(tcpServer);
      serverTerminal?.setServiceStatus('http', 'stopped');
      serverTerminal?.setServiceStatus('tcp', 'stopped');
    },
  };
}

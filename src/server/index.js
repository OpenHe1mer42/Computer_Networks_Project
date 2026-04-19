import { config } from '../config/env.js';
import { createLogger } from '../shared/logger.js';
import { createStatsServer } from './http/ceateStatsServer.js';
import { ConnectionRegistry } from './services/ConnectionRegistry.js';
import { CommandService } from './services/commandService.js';
import { FileService } from './services/fileservice.js';
import { MessageStore } from './services/messageStore.js';
import { createTcpServer } from './transport/tcpServer.js';

const logger = createLogger({
  name: 'server',
  logFile: config.storage.serverLogFile,
});

const connectionRegistry = new ConnectionRegistry();

const messageStore = new MessageStore({
  messageLogFile: config.storage.messageLogFile,
  recentLimit: config.stats.recentMessageLimit,
});

const fileService = new FileService({
  baseDir: config.storage.serverFilesDir,
});

await fileService.init();

const commandService = new CommandService({
  fileService,
  readOnlyResponseDelayMs: config.behavior.readOnlyResponseDelayMs,
});

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

tcpServer.listen(config.socket.port, config.socket.host, () => {
  logger.info('TCP server listening.', {
    host: config.socket.host,
    port: config.socket.port,
  });
});

statsServer.listen(config.http.port, config.http.host, () => {
  logger.info('HTTP stats server listening.', {
    host: config.http.host,
    port: config.http.port,
  });
});

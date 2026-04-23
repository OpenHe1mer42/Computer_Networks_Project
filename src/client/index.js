import path from 'node:path';

import { config } from '../config/env.js';
import { createLogger } from '../shared/logger.js';
import { runCli } from './cli/runCli.js';
import { LocalFileService } from './services/localFileService.js';
import { TcpClient } from './transport/tcpClient.js';

function parseArgs(argv) {
  const options = {
    reconnectEnabled: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    switch (current) {
      case '--clientId':
        options.clientId = argv[index + 1];
        index += 1;
        break;
      case '--name':
        options.name = argv[index + 1];
        index += 1;
        break;
      case '--adminToken':
        options.adminToken = argv[index + 1];
        index += 1;
        break;
      case '--no-reconnect':
        options.reconnectEnabled = false;
        break;
      case '--help':
        process.stdout.write('Usage: npm run client -- --clientId <id> --name <name> [--adminToken <token>] [--no-reconnect]\n');
        process.exit(0);
        break;
      default:
        break;
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const clientLogFile = path.join(path.dirname(config.storage.serverLogFile), 'client.log');

createLogger({
  name: 'client',
  logFile: clientLogFile,
});

const localFileService = new LocalFileService({
  uploadsDir: config.storage.clientUploadsDir,
  downloadsDir: config.storage.clientDownloadsDir,
});

const client = new TcpClient({
  host: config.socket.host,
  port: config.socket.port,
  reconnectDelayMs: config.behavior.reconnectDelayMs,
  reconnectEnabled: options.reconnectEnabled,
  handshake: {
    clientId: options.clientId ?? config.client.clientId,
    name: options.name ?? config.client.clientName,
    adminToken: options.adminToken ?? config.client.adminToken,
  },
});

await runCli({
  client,
  localFileService,
});

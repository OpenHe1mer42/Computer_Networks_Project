import 'dotenv/config';

import path from 'node:path';

const rootDir = process.cwd();

function readString(name, fallback = '') {
  return process.env[name] ?? fallback;
}

function readInteger(name, fallback, { min = 0 } = {}) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }

  const value = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(value) || value < min) {
    throw new Error(`${name} must be an integer greater than or equal to ${min}.`);
  }

  return value;
}

function resolveProjectPath(value) {
  return path.resolve(rootDir, value);
}

export const config = {
  rootDir,
  socket: {
    host: readString('SOCKET_HOST', '127.0.0.1'),
    port: readInteger('SOCKET_PORT', 4000, { min: 1 }),
    maxConnections: readInteger('MAX_CONNECTIONS', 4, { min: 1 }),
    inactivityTimeoutMs: readInteger('INACTIVITY_TIMEOUT_MS', 60_000, { min: 1 }),
  },
  http: {
    host: readString('HTTP_HOST', '127.0.0.1'),
    port: readInteger('HTTP_PORT', 8080, { min: 1 }),
  },
  auth: {
    adminSecret: readString('ADMIN_SECRET', 'change-me-admin-secret'),
  },
  stats: {
    recentMessageLimit: readInteger('STATS_RECENT_MESSAGE_LIMIT', 25, { min: 1 }),
  },
  behavior: {
    readOnlyResponseDelayMs: readInteger('READ_ONLY_RESPONSE_DELAY_MS', 150, { min: 0 }),
    reconnectDelayMs: readInteger('RECONNECT_DELAY_MS', 3_000, { min: 0 }),
  },
  storage: {
    serverFilesDir: resolveProjectPath(readString('SERVER_FILES_DIR', 'storage/server-files')),
    serverLogFile: resolveProjectPath(readString('SERVER_LOG_FILE', 'storage/logs/server.log')),
    messageLogFile: resolveProjectPath(readString('MESSAGE_LOG_FILE', 'storage/messages/client-messages.ndjson')),
    clientUploadsDir: resolveProjectPath(readString('CLIENT_UPLOADS_DIR', 'storage/client/uploads')),
    clientDownloadsDir: resolveProjectPath(readString('CLIENT_DOWNLOADS_DIR', 'storage/client/downloads')),
  },
  client: {
    clientId: readString('CLIENT_ID', 'client-1'),
    clientName: readString('CLIENT_NAME', 'Client 1'),
    adminToken: readString('CLIENT_ADMIN_TOKEN', ''),
  },
};

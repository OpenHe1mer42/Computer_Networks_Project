import fs from 'node:fs';
import path from 'node:path';

function normalizeMeta(meta) {
  if (!meta) {
    return undefined;
  }

  if (meta instanceof Error) {
    return {
      name: meta.name,
      message: meta.message,
      stack: meta.stack,
    };
  }

  return meta;
}

export function createLogger({ name, logFile }) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });

  function write(level, message, meta) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      logger: name,
      message,
      meta: normalizeMeta(meta),
    };

    const line = JSON.stringify(entry);
    const output = level === 'error' ? console.error : console.log;
    output(line);

    try {
      fs.appendFileSync(logFile, `${line}\n`, 'utf8');
    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        logger: `${name}:fallback`,
        message: 'Failed to append to log file.',
        meta: normalizeMeta(error),
      }));
    }
  }

  return {
    info(message, meta) {
      write('info', message, meta);
    },
    warn(message, meta) {
      write('warn', message, meta);
    },
    error(message, meta) {
      write('error', message, meta);
    },
  };
}
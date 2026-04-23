import readline from 'node:readline';

import {
  ANSI,
  clampText,
  color,
  formatDuration,
  formatTime,
} from '../../shared/terminalFormat.js';

const BANNER = String.raw`
 /$$   /$$ /$$$$$$$$ /$$$$$$$$ /$$      /$$  /$$$$$$  /$$$$$$$  /$$   /$$        /$$$$$$  /$$$$$$$$ /$$$$$$$  /$$    /$$ /$$$$$$$$ /$$$$$$$
| $$$ | $$| $$_____/|__  $$__/| $$  /$ | $$ /$$__  $$| $$__  $$| $$  /$$/       /$$__  $$| $$_____/| $$__  $$| $$   | $$| $$_____/| $$__  $$
| $$$$| $$| $$         | $$   | $$ /$$$| $$| $$  \ $$| $$  \ $$| $$ /$$/       | $$  \__/| $$      | $$  \ $$| $$   | $$| $$      | $$  \ $$
| $$ $$ $$| $$$$$      | $$   | $$/$$ $$ $$| $$  | $$| $$$$$$$/| $$$$$/        |  $$$$$$ | $$$$$   | $$$$$$$/|  $$ / $$/| $$$$$   | $$$$$$$/
| $$  $$$$| $$__/      | $$   | $$$$_  $$$$| $$  | $$| $$__  $$| $$  $$         \____  $$| $$__/   | $$__  $$ \  $$ $$/ | $$__/   | $$__  $$
| $$\  $$$| $$         | $$   | $$$/ \  $$$| $$  | $$| $$  \ $$| $$\  $$        /$$  \ $$| $$      | $$  \ $$  \  $$$/  | $$      | $$  \ $$
| $$ \  $$| $$$$$$$$   | $$   | $$/   \  $$|  $$$$$$/| $$  | $$| $$ \  $$      |  $$$$$$/| $$$$$$$$| $$  | $$   \  $/   | $$$$$$$$| $$  | $$
|__/  \__/|________/   |__/   |__/     \__/ \______/ |__/  |__/|__/  \__/       \______/ |________/|__/  |__/    \_/    |________/|__/  |__/
`;

function formatMeta(meta) {
  if (!meta || typeof meta !== 'object') {
    return '';
  }

  const fields = [];

  for (const key of ['socketId', 'clientId', 'role', 'remoteAddress', 'host', 'port', 'signal']) {
    if (meta[key] !== undefined && meta[key] !== null) {
      fields.push(`${key}=${meta[key]}`);
    }
  }

  if (meta.error?.message) {
    fields.push(`error=${meta.error.message}`);
  } else if (meta.message && meta.name) {
    fields.push(`error=${meta.message}`);
  }

  return fields.length > 0 ? ` (${fields.join(' ')})` : '';
}

export class ServerTerminal {
  constructor({
    interactive,
    output = process.stdout,
  }) {
    this.interactive = interactive;
    this.output = output;
    this.startedAt = Date.now();
    this.services = {
      tcp: 'starting',
      http: 'starting',
    };
    this.logs = [];
    this.statsProvider = null;
    this.clock = null;
  }

  printStartupBanner() {
    if (!this.interactive) {
      this.output.write(`${BANNER}\n`);
      return;
    }

    this.render();
  }

  setStatsProvider(statsProvider) {
    this.statsProvider = statsProvider;
    this.render();
  }

  setServiceStatus(service, status) {
    this.services[service] = status;
    this.render();
  }

  addLogEntry(entry) {
    if (!this.interactive) {
      return;
    }

    this.logs.unshift({
      ...entry,
      at: new Date(entry.timestamp ?? Date.now()),
    });
    this.logs = this.logs.slice(0, 9);
    this.render();
  }

  startClock() {
    if (!this.interactive || this.clock) {
      return;
    }

    this.clock = setInterval(() => this.render(), 1000);
    this.clock.unref();
  }

  stopClock() {
    if (this.clock) {
      clearInterval(this.clock);
      this.clock = null;
    }

    if (this.interactive) {
      this.output.write(ANSI.showCursor);
    }
  }

  render() {
    if (!this.interactive) {
      return;
    }

    const supportsColor = this.output.isTTY;
    const columns = Math.max(88, this.output.columns || 110);
    const rows = Math.max(28, this.output.rows || 36);
    const bodyWidth = columns - 4;
    const stats = this.statsProvider?.() ?? {
      totalConnectionsSeen: 0,
      activeConnections: 0,
      activeClients: [],
      knownClients: [],
    };
    const lines = [];

    lines.push(color(BANNER.trimEnd(), ANSI.cyan, supportsColor));
    lines.push(`${color('NETWORK SERVER', ANSI.bold, supportsColor)}  uptime ${formatDuration(Date.now() - this.startedAt)}`);
    lines.push('-'.repeat(columns));
    lines.push([
      `TCP ${this.services.tcp}`,
      `HTTP ${this.services.http}`,
      `active ${stats.activeConnections}`,
      `seen ${stats.totalConnectionsSeen}`,
      `known ${stats.knownClients.length}`,
    ].join(' | '));
    lines.push('-'.repeat(columns));
    lines.push(color('Active clients', ANSI.cyan, supportsColor));

    if (stats.activeClients.length === 0) {
      lines.push('  No clients connected.');
    } else {
      for (const client of stats.activeClients.slice(0, 8)) {
        lines.push(`  ${clampText(`${client.clientId} (${client.role}) ${client.remoteAddress} last ${client.lastSeenAt}`, bodyWidth)}`);
      }
    }

    lines.push('-'.repeat(columns));
    lines.push(color('Server events', ANSI.cyan, supportsColor));

    if (this.logs.length === 0) {
      lines.push('  Waiting for server events.');
    } else {
      for (const entry of this.logs) {
        const levelColor = entry.level === 'error'
          ? ANSI.red
          : entry.level === 'warn'
            ? ANSI.yellow
            : ANSI.green;
        const level = color(entry.level.toUpperCase().padEnd(5), levelColor, supportsColor);
        const message = `${entry.message}${formatMeta(entry.meta)}`;
        lines.push(`  ${level} ${formatTime(entry.at)} ${clampText(message, bodyWidth - 16)}`);
      }
    }

    const visibleLines = lines.slice(0, rows - 1);
    this.output.write(ANSI.hideCursor);
    readline.cursorTo(this.output, 0, 0);
    readline.clearScreenDown(this.output);
    this.output.write(`${visibleLines.join('\n')}\n`);
    this.output.write(ANSI.showCursor);
  }
}

export function createServerTerminal({ interactive }) {
  return new ServerTerminal({ interactive });
}

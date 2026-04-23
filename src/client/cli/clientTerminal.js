import readline from 'node:readline';

import {
  ANSI,
  clampText,
  color,
  formatDuration,
  formatTime,
  wrapText,
} from '../../shared/terminalFormat.js';

const HELP_LINES = [
  '/help',
  '/list [path]',
  '/read <filename>',
  '/search <keyword>',
  '/info <filename>',
  '/upload <filename>',
  '/download <filename>',
  '/delete <filename>',
  '/quit',
  'plain text sends a chat message',
];

function formatPayload(payload) {
  return JSON.stringify(payload, null, 2);
}

function buildCommandKey(input) {
  return input.trim().replace(/\s+/g, ' ');
}

function statusColor(status) {
  switch (status) {
    case 'ready':
    case 'saved':
    case 'sent':
      return ANSI.green;
    case 'waiting':
    case 'queued':
      return ANSI.yellow;
    case 'error':
      return ANSI.red;
    default:
      return ANSI.blue;
  }
}

export class ClientTerminal {
  constructor({
    interactive,
    readlineInterface,
    output = process.stdout,
  }) {
    this.interactive = interactive;
    this.readlineInterface = readlineInterface;
    this.output = output;
    this.startedAt = Date.now();
    this.connected = false;
    this.connectionText = 'starting';
    this.role = null;
    this.clientId = null;
    this.events = [];
    this.commands = new Map();
    this.pendingCommands = [];
  }

  printLine(message) {
    if (this.interactive) {
      this.addEvent('info', message);
      return;
    }

    this.output.write(`${message}\n`);
  }

  showHelp() {
    this.markLocalCommand('/help', {
      label: '/help',
      status: 'ready',
      detail: 'Available commands',
      output: HELP_LINES.join('\n'),
      command: 'help',
    });
  }

  setConnection({ connected, text, clientId, role }) {
    this.connected = connected;
    this.connectionText = text;

    if (clientId) {
      this.clientId = clientId;
    }

    if (role) {
      this.role = role;
    }

    this.render();
  }

  addEvent(level, message) {
    if (!this.interactive) {
      this.output.write(`${message}\n`);
      return;
    }

    this.events.unshift({
      level,
      message,
      at: new Date(),
    });

    this.events = this.events.slice(0, 6);
    this.render();
  }

  markCommandPending(input, command) {
    const key = buildCommandKey(input);
    const existing = this.commands.get(key);
    const runCount = (existing?.runCount ?? 0) + 1;

    this.commands.set(key, {
      key,
      label: key,
      command,
      status: existing?.output ? 'waiting' : 'queued',
      detail: existing?.output ? 'refreshing previous result' : 'waiting for server',
      output: existing?.output ?? '',
      runCount,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });

    this.pendingCommands.push({ key, command });
    this.render();
    return key;
  }

  markCommandError(key, message) {
    const existing = this.commands.get(key);

    if (!existing) {
      return;
    }

    this.commands.set(key, {
      ...existing,
      status: 'error',
      detail: message,
      output: message,
      updatedAt: Date.now(),
    });
    this.render();
  }

  markLocalCommand(input, { status = 'ready', detail, output, command }) {
    const key = buildCommandKey(input);
    const existing = this.commands.get(key);

    this.commands.set(key, {
      key,
      label: key,
      command,
      status,
      detail,
      output,
      runCount: (existing?.runCount ?? 0) + 1,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });
    this.render();
  }

  finishCommand(frame, output) {
    const pendingIndex = this.pendingCommands.findIndex((pending) => pending.command === frame.command);
    const pending = pendingIndex >= 0
      ? this.pendingCommands.splice(pendingIndex, 1)[0]
      : this.pendingCommands.shift();
    const key = pending?.key ?? `/${frame.command}`;
    const existing = this.commands.get(key);

    this.commands.set(key, {
      key,
      label: existing?.label ?? key,
      command: frame.command,
      status: 'ready',
      detail: `updated ${formatTime()}`,
      output,
      runCount: existing?.runCount ?? 1,
      startedAt: existing?.startedAt ?? Date.now(),
      updatedAt: Date.now(),
    });
    this.render();
  }

  finishCommandError(frame) {
    const pendingIndex = this.pendingCommands.findIndex((pending) => pending.command === frame.command);
    const pending = pendingIndex >= 0
      ? this.pendingCommands.splice(pendingIndex, 1)[0]
      : this.pendingCommands.shift();
    const key = pending?.key ?? `/${frame.command}`;
    const existing = this.commands.get(key);

    this.commands.set(key, {
      key,
      label: existing?.label ?? key,
      command: frame.command,
      status: 'error',
      detail: `failed ${formatTime()}`,
      output: frame.error,
      runCount: existing?.runCount ?? 1,
      startedAt: existing?.startedAt ?? Date.now(),
      updatedAt: Date.now(),
    });
    this.render();
  }

  render() {
    if (!this.interactive) {
      return;
    }

    const supportsColor = this.output.isTTY;
    const columns = Math.max(72, this.output.columns || 100);
    const rows = Math.max(24, this.output.rows || 32);
    const bodyWidth = columns - 4;
    const lines = [];
    const connection = this.connected
      ? color('ONLINE', ANSI.green, supportsColor)
      : color(this.connectionText.toUpperCase(), ANSI.yellow, supportsColor);
    const identity = [
      this.clientId ? `client ${this.clientId}` : 'client pending',
      this.role ? `role ${this.role}` : null,
      `uptime ${formatDuration(Date.now() - this.startedAt)}`,
    ].filter(Boolean).join(' | ');

    lines.push(color('SOCKET CLIENT', ANSI.bold, supportsColor));
    lines.push(`${connection}  ${identity}`);
    lines.push('-'.repeat(columns));
    lines.push(color('Command output', ANSI.cyan, supportsColor));

    const commandCards = [...this.commands.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 4);

    if (commandCards.length === 0) {
      lines.push('  Enter /help or any command. Results will update here.');
    }

    for (const command of commandCards) {
      const age = command.status === 'queued' || command.status === 'waiting'
        ? ` | ${formatDuration(Date.now() - command.startedAt)}`
        : '';
      const status = color(command.status.toUpperCase(), statusColor(command.status), supportsColor);
      const title = `${status} ${command.label} | runs ${command.runCount}${age}`;
      lines.push(`+ ${clampText(title, bodyWidth - 2)}`);

      if (command.detail) {
        lines.push(`  ${clampText(command.detail, bodyWidth)}`);
      }

      const outputLines = wrapText(command.output || '(waiting for output)', bodyWidth - 2).slice(0, 8);
      for (const outputLine of outputLines) {
        lines.push(`  ${outputLine}`);
      }

      if (wrapText(command.output || '', bodyWidth - 2).length > outputLines.length) {
        lines.push(color('  ... output trimmed for the terminal view', ANSI.dim, supportsColor));
      }
    }

    lines.push('-'.repeat(columns));
    lines.push(color('Recent events', ANSI.cyan, supportsColor));

    if (this.events.length === 0) {
      lines.push('  No events yet.');
    } else {
      for (const event of this.events.slice(0, 5)) {
        const marker = event.level === 'error'
          ? color('ERR', ANSI.red, supportsColor)
          : color('LOG', ANSI.blue, supportsColor);
        lines.push(`  ${marker} ${formatTime(event.at)} ${clampText(event.message, bodyWidth - 14)}`);
      }
    }

    const maxRenderedLines = rows - 2;
    const visibleLines = lines.slice(0, maxRenderedLines);
    this.output.write(ANSI.hideCursor);
    readline.cursorTo(this.output, 0, 0);
    readline.clearScreenDown(this.output);
    this.output.write(`${visibleLines.join('\n')}\n`);
    this.readlineInterface.prompt(true);
    this.output.write(ANSI.showCursor);
  }
}

export function formatServerFrame(frame, localFilePath) {
  switch (frame.type) {
    case 'hello_ack':
      return `[server] ${frame.message} clientId=${frame.clientId} role=${frame.role} reconnectCount=${frame.reconnectCount}`;
    case 'ack':
      return `[server] ${frame.message}`;
    case 'command_result':
      if (!frame.ok) {
        return `[server:error] ${frame.error}`;
      }

      if (frame.command === 'download') {
        return `[server] Download saved to ${localFilePath}`;
      }

      return `[server] ${frame.command} result:\n${formatPayload(frame.data)}`;
    case 'error':
      return `[server:error] ${frame.message}`;
    case 'system':
      return `[server:system] ${frame.message}`;
    default:
      return `[server] ${formatPayload(frame)}`;
  }
}

import readline from 'node:readline';

import { ClientTerminal, formatServerFrame } from './clientTerminal.js';

function printLine(message) {
  process.stdout.write(`${message}\n`);
}

function formatPayload(payload) {
  return JSON.stringify(payload, null, 2);
}

function printHelp() {
  printLine('Commands:');
  printLine('  /help');
  printLine('  /list [path]');
  printLine('  /read <filename>');
  printLine('  /search <keyword>');
  printLine('  /info <filename>');
  printLine('  /upload <filename>');
  printLine('  /download <filename>');
  printLine('  /delete <filename>');
  printLine('  /quit');
  printLine('  any other text sends a chat message to the server');
}

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdin.isTTY,
  });
}

function parseCommand(input) {
  const [command, ...rest] = input.split(/\s+/);
  return {
    command,
    args: rest,
  };
}

export async function runCli({ client, localFileService }) {
  await localFileService.init();

  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const readlineInterface = createReadline();
  const terminal = new ClientTerminal({
    interactive,
    readlineInterface,
  });
  let frameQueue = Promise.resolve();
  let inputQueue = Promise.resolve();

  async function handleServerFrame(frame) {
    switch (frame.type) {
      case 'hello_ack':
        terminal.setConnection({
          connected: true,
          text: 'connected',
          clientId: frame.clientId,
          role: frame.role,
        });
        terminal.addEvent('info', formatServerFrame(frame));
        break;
      case 'ack':
        terminal.addEvent('info', formatServerFrame(frame));
        break;
      case 'command_result':
        if (!frame.ok) {
          terminal.finishCommandError(frame);
          if (!interactive) {
            printLine(formatServerFrame(frame));
          }
          break;
        }

        if (frame.command === 'download') {
          const savedFile = await localFileService.writeDownload(frame.data.path, frame.data.contentBase64);
          const message = formatServerFrame(frame, savedFile.filePath);
          terminal.finishCommand(frame, `Download saved to ${savedFile.filePath}`);
          if (!interactive) {
            printLine(message);
          }
          break;
        }

        terminal.finishCommand(frame, formatPayload(frame.data));
        if (!interactive) {
          printLine(formatServerFrame(frame));
        }
        break;
      case 'error':
        terminal.addEvent('error', formatServerFrame(frame));
        break;
      case 'system':
        terminal.addEvent('info', formatServerFrame(frame));
        break;
      default:
        terminal.addEvent('info', formatServerFrame(frame));
        break;
    }
  }

  client.on('frame', (frame) => {
    frameQueue = frameQueue
      .then(() => handleServerFrame(frame))
      .catch((error) => {
        terminal.addEvent('error', `[client:error] ${error.message}`);
      });
  });

  client.on('connected', () => {
    terminal.setConnection({
      connected: true,
      text: 'connected',
    });
    terminal.addEvent('info', '[client] Connected. Sending hello frame.');
  });

  client.on('disconnected', ({ reconnecting }) => {
    terminal.setConnection({
      connected: false,
      text: reconnecting ? 'reconnecting' : 'disconnected',
    });
    terminal.addEvent('info', reconnecting
      ? '[client] Disconnected. Reconnect is enabled.'
      : '[client] Disconnected.');
  });

  client.on('reconnect_scheduled', ({ attempt }) => {
    terminal.addEvent('info', `[client] Reconnect attempt ${attempt} starting.`);
  });

  client.on('error', (error) => {
    terminal.addEvent('error', `[client:error] ${error.message}`);
  });

  client.connect();

  if (interactive) {
    readlineInterface.setPrompt('socket> ');
    terminal.showHelp();
  } else {
    printHelp();
  }

  async function handleInputLine(line) {
    const input = line.trim();

    if (!input) {
      terminal.render();
      return;
    }

    if (!input.startsWith('/')) {
      const sent = client.send({
        type: 'chat',
        text: input,
      });

      if (!sent) {
        terminal.addEvent('error', '[client:error] Client is not currently connected.');
      } else {
        terminal.markLocalCommand(`message ${Date.now()}`, {
          status: 'sent',
          detail: 'chat message queued for the server',
          output: input,
          command: 'chat',
        });
      }

      return;
    }

    const { command, args } = parseCommand(input.slice(1));

    try {
      switch (command) {
        case 'help':
          if (interactive) {
            terminal.showHelp();
          } else {
            printHelp();
          }
          break;
        case 'list': {
          terminal.markCommandPending(`/list ${args[0] ?? '.'}`, 'list');
          client.send({
            type: 'command',
            command: 'list',
            path: args[0] ?? '.',
          });
          break;
        }
        case 'read':
          terminal.markCommandPending(`/read ${args[0] ?? ''}`, 'read');
          client.send({
            type: 'command',
            command: 'read',
            filename: args[0],
          });
          break;
        case 'search':
          terminal.markCommandPending(`/search ${args.join(' ')}`, 'search');
          client.send({
            type: 'command',
            command: 'search',
            keyword: args.join(' '),
          });
          break;
        case 'info':
          terminal.markCommandPending(`/info ${args[0] ?? ''}`, 'info');
          client.send({
            type: 'command',
            command: 'info',
            filename: args[0],
          });
          break;
        case 'upload': {
          const filename = args[0];
          const upload = await localFileService.readUpload(filename);
          terminal.markCommandPending(`/upload ${filename ?? ''}`, 'upload');
          client.send({
            type: 'command',
            command: 'upload',
            filename,
            contentBase64: upload.contentBase64,
          });
          terminal.addEvent('info', `[client] Upload queued for ${filename}.`);
          break;
        }
        case 'download':
          terminal.markCommandPending(`/download ${args[0] ?? ''}`, 'download');
          client.send({
            type: 'command',
            command: 'download',
            filename: args[0],
          });
          break;
        case 'delete':
          terminal.markCommandPending(`/delete ${args[0] ?? ''}`, 'delete');
          client.send({
            type: 'command',
            command: 'delete',
            filename: args[0],
          });
          break;
        case 'quit':
          client.disconnect();
          readlineInterface.close();
          return;
        default:
          terminal.markLocalCommand(input, {
            status: 'error',
            detail: 'unknown command',
            output: `Unknown command "${command}".`,
            command,
          });
          break;
      }
    } catch (error) {
      terminal.addEvent('error', `[client:error] ${error.message}`);
    }

    terminal.render();
  }

  readlineInterface.on('line', (line) => {
    inputQueue = inputQueue
      .then(() => handleInputLine(line))
      .catch((error) => {
        printLine(`[client:error] ${error.message}`);
      });
  });

  readlineInterface.on('close', () => {
    if (interactive) {
      process.exit(0);
      return;
    }

    setTimeout(() => {
      client.disconnect();
      process.exit(0);
    }, 1200);
  });
}

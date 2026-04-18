import readline from 'node:readline';

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
  let frameQueue = Promise.resolve();
  let inputQueue = Promise.resolve();

  async function handleServerFrame(frame) {
    switch (frame.type) {
      case 'hello_ack':
        printLine(`[server] ${frame.message} clientId=${frame.clientId} role=${frame.role} reconnectCount=${frame.reconnectCount}`);
        break;
      case 'ack':
        printLine(`[server] ${frame.message}`);
        break;
      case 'command_result':
        if (!frame.ok) {
          printLine(`[server:error] ${frame.error}`);
          break;
        }

        if (frame.command === 'download') {
          const savedFile = await localFileService.writeDownload(frame.data.path, frame.data.contentBase64);
          printLine(`[server] Download saved to ${savedFile.filePath}`);
          break;
        }

        printLine(`[server] ${frame.command} result:\n${formatPayload(frame.data)}`);
        break;
      case 'error':
        printLine(`[server:error] ${frame.message}`);
        break;
      case 'system':
        printLine(`[server:system] ${frame.message}`);
        break;
      default:
        printLine(`[server] ${formatPayload(frame)}`);
        break;
    }

    if (interactive) {
      readlineInterface.prompt();
    }
  }
 client.on('frame', (frame) => {
    frameQueue = frameQueue
      .then(() => handleServerFrame(frame))
      .catch((error) => {
        printLine(`\[client:error] ${error.message}`);
      });
  });

  client.on('connected', () => {
    printLine('[client] Connected. Sending hello frame.');
    if (interactive) {
      readlineInterface.prompt();
    }
  });

  client.on('disconnected', ({ reconnecting }) => {
    printLine(reconnecting
      ? '[client] Disconnected. Reconnect is enabled.'
      : '[client] Disconnected.');

    if (interactive) {
      readlineInterface.prompt();
    }
  });

  client.on('reconnect_scheduled', ({ attempt }) => {
    printLine(`\[client] Reconnect attempt ${attempt} starting.`);
  });

  client.on('error', (error) => {
    printLine(`\[client:error] ${error.message}`);
    if (interactive) {
      readlineInterface.prompt();
    }
  });

  client.connect();

  if (interactive) {
    printHelp();
    readlineInterface.setPrompt('socket> ');
    readlineInterface.prompt();
  }

  async function handleInputLine(line) {
    const input = line.trim();

    if (!input) {
      if (interactive) {
        readlineInterface.prompt();
      }
      return;
    }

    if (!input.startsWith('/')) {
      const sent = client.send({
        type: 'chat',
        text: input,
      });

      if (!sent) {
        printLine('[client:error] Client is not currently connected.');
      }

      if (interactive) {
        readlineInterface.prompt();
      }
      return;
    }

    const { command, args } = parseCommand(input.slice(1));

    try {
      switch (command) {
        case 'help':
          printHelp();
          break;
        case 'list':
          client.send({
            type: 'command',
            command: 'list',
            path: args[0] ?? '.',
          });
          break;
        case 'read':
          client.send({
            type: 'command',
            command: 'read',
            filename: args[0],
          });
          break;
        case 'search':
          client.send({
            type: 'command',
            command: 'search',
            keyword: args.join(' '),
          });
          break;
        case 'info':
          client.send({
            type: 'command',
            command: 'info',
            filename: args[0],
          });
          break;
        case 'upload': {
          const filename = args[0];
          const upload = await localFileService.readUpload(filename);
          client.send({
            type: 'command',
            command: 'upload',
            filename,
            contentBase64: upload.contentBase64,
          });
          printLine(`\[client] Upload queued for ${filename}.`);
          break;
        }
        case 'download':
          client.send({
            type: 'command',
            command: 'download',
            filename: args[0],
          });
          break;
        case 'delete':
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
          printLine(`\[client:error] Unknown command "${command}".`);
          break;
      }
    } catch (error) {
      printLine(`\[client:error] ${error.message}`);
    }

    if (interactive) {
      readlineInterface.prompt();
    }
  }

  readlineInterface.on('line', (line) => {
    inputQueue = inputQueue
      .then(() => handleInputLine(line))
      .catch((error) => {
        printLine(`\[client:error] ${error.message}`);
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



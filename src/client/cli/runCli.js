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


  }
} 
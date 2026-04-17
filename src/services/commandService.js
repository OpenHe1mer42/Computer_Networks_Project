const ROLE_PERMISSIONS = {
  admin: new Set(['list', 'read', 'upload', 'download', 'delete', 'search', 'info']),
  readonly: new Set(['list', 'read', 'download', 'search', 'info']),
};

function wait(delayMs) {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export class CommandService {
  constructor({ fileService, readOnlyResponseDelayMs }) {
    this.fileService = fileService;
    this.readOnlyResponseDelayMs = readOnlyResponseDelayMs;
  }

  async execute(session, frame) {
    const command = String(frame.command ?? '').trim().toLowerCase();
    const permissions = ROLE_PERMISSIONS[session.role] ?? ROLE_PERMISSIONS.readonly;

    if (!permissions.has(command)) {
      throw new Error(`Command "${command}" is not allowed for role "${session.role}".`);
    }

    if (session.role !== 'admin') {
      await wait(this.readOnlyResponseDelayMs);
    }

    switch (command) {
      case 'list':
        return {
          command,
          data: await this.fileService.list(frame.path ?? '.'),
        };
      case 'read':
        return {
          command,
          data: await this.fileService.read(frame.filename),
        };
      case 'upload':
        return {
          command,
          data: await this.fileService.upload(frame.filename, frame.contentBase64),
        };
      case 'download':
        return {
          command,
          data: await this.fileService.download(frame.filename),
        };
      case 'delete':
        return {
          command,
          data: await this.fileService.delete(frame.filename),
        };
      case 'search':
        return {
          command,
          data: await this.fileService.search(frame.keyword, frame.path ?? '.'),
        };
      case 'info':
        return {
          command,
          data: await this.fileService.info(frame.filename),
        };
      default:
        throw new Error(`Unknown command "${command}".`);
    }
  }
}

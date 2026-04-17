import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveSafePath } from '../../shared/safe-paths.js';

export class LocalFileService {
  constructor({ uploadsDir, downloadsDir }) {
    this.uploadsDir = uploadsDir;
    this.downloadsDir = downloadsDir;
  }

  async init() {
    await fs.mkdir(this.uploadsDir, { recursive: true });
    await fs.mkdir(this.downloadsDir, { recursive: true });
  }

  async readUpload(filename) {
    const filePath = resolveSafePath(this.uploadsDir, filename);
    const fileBuffer = await fs.readFile(filePath);

    return {
      filename,
      contentBase64: fileBuffer.toString('base64'),
      size: fileBuffer.length,
    };
  }

  async writeDownload(filename, contentBase64) {
    const filePath = resolveSafePath(this.downloadsDir, filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const fileBuffer = Buffer.from(contentBase64, 'base64');
    await fs.writeFile(filePath, fileBuffer);

    return {
      filePath,
      size: fileBuffer.length,
    };
  }
}

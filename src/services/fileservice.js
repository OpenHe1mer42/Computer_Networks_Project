import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveSafePath, toPortableRelativePath } from '../../shared/safe-paths.js';

async function walkDirectory(directoryPath) {
  const dirents = await fs.readdir(directoryPath, { withFileTypes: true });
  const entries = [];

  for (const dirent of dirents) {
    const absolutePath = path.join(directoryPath, dirent.name);
    entries.push({
      dirent,
      absolutePath,
    });

    if (dirent.isDirectory()) {
      entries.push(...await walkDirectory(absolutePath));
    }
  }

  return entries;
}

export class FileService {
  constructor({ baseDir }) {
    this.baseDir = baseDir;
  }

  async init() {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  async list(relativePath = '.') {
    const directoryPath = resolveSafePath(this.baseDir, relativePath);
    const dirents = await fs.readdir(directoryPath, { withFileTypes: true });

    const entries = await Promise.all(
      dirents
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(async (dirent) => {
          const absolutePath = path.join(directoryPath, dirent.name);
          const stats = await fs.stat(absolutePath);

          return {
            name: dirent.name,
            type: dirent.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            path: toPortableRelativePath(this.baseDir, absolutePath),
          };
        }),
    );

    return {
      path: toPortableRelativePath(this.baseDir, directoryPath),
      entries,
    };
  }
   async read(relativePath) {
    const filePath = resolveSafePath(this.baseDir, relativePath);
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      throw new Error('Target is not a file.');
    }

    return {
      path: toPortableRelativePath(this.baseDir, filePath),
      size: stats.size,
      content: await fs.readFile(filePath, 'utf8'),
    };
  }

  async upload(relativePath, contentBase64) {
    const filePath = resolveSafePath(this.baseDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const fileBuffer = Buffer.from(contentBase64, 'base64');
    await fs.writeFile(filePath, fileBuffer);
    return {
      path: toPortableRelativePath(this.baseDir, filePath),
      size: fileBuffer.length,
    };
  }

  async download(relativePath) {
    const filePath = resolveSafePath(this.baseDir, relativePath);
    const fileBuffer = await fs.readFile(filePath);

    return {
      path: toPortableRelativePath(this.baseDir, filePath),
      size: fileBuffer.length,
      contentBase64: fileBuffer.toString('base64'),
    };
  }

  async delete(relativePath) {
    const filePath = resolveSafePath(this.baseDir, relativePath);
    await fs.unlink(filePath);

    return {
      path: toPortableRelativePath(this.baseDir, filePath),
      deleted: true,
    };
  }

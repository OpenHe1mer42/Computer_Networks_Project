import path from 'node:path';

export function resolveSafePath(baseDir, requestedPath = '.') {
  if (typeof requestedPath !== 'string' || !requestedPath.trim()) {
    throw new Error('A path string is required.');
  }

  if (requestedPath.includes('\0')) {
    throw new Error('Invalid path.');
  }

  const normalizedRequest = requestedPath.replace(/\\/g, '/').replace(/^\/+/, '') || '.';
  const resolvedPath = path.resolve(baseDir, normalizedRequest);
  const relativePath = path.relative(baseDir, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Path escapes the configured storage root.');
  }

  return resolvedPath;
}

export function toPortableRelativePath(baseDir, absolutePath) {
  const relativePath = path.relative(baseDir, absolutePath) || '.';
  return relativePath.split(path.sep).join('/');
}
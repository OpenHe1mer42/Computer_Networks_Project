export const ANSI = {
  clear: '\u001b[2J',
  home: '\u001b[H',
  hideCursor: '\u001b[?25l',
  showCursor: '\u001b[?25h',
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  cyan: '\u001b[36m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
  blue: '\u001b[34m',
};

export function color(text, code, enabled = true) {
  return enabled ? `${code}${text}${ANSI.reset}` : text;
}

export function stripAnsi(value) {
  return String(value).replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '');
}

export function visibleLength(value) {
  return stripAnsi(value).length;
}

export function clampText(value, maxLength) {
  const text = String(value);

  if (maxLength <= 0 || visibleLength(text) <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1))}.`;
}

export function wrapText(value, width) {
  const lines = [];
  const maxWidth = Math.max(10, width);

  for (const sourceLine of String(value).split('\n')) {
    let line = sourceLine;

    while (visibleLength(line) > maxWidth) {
      let splitAt = line.lastIndexOf(' ', maxWidth);

      if (splitAt < Math.floor(maxWidth * 0.6)) {
        splitAt = maxWidth;
      }

      lines.push(line.slice(0, splitAt).trimEnd());
      line = line.slice(splitAt).trimStart();
    }

    lines.push(line);
  }

  return lines;
}

export function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDuration(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}


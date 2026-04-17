export function encodeFrame(frame) {
  return `${JSON.stringify({ sentAt: new Date().toISOString(), ...frame })}\n`;
}

export function sendFrame(socket, frame) {
  socket.write(encodeFrame(frame));
}

export function attachJsonLineParser(stream, { onFrame, onParseError }) {
  let buffer = '';

  stream.on('data', (chunk) => {
    buffer += chunk;

    while (buffer.includes('\n')) {
      const newlineIndex = buffer.indexOf('\n');
      const rawLine = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!rawLine) {
        continue;
      }

      try {
        onFrame(JSON.parse(rawLine));
      } catch (error) {
        onParseError?.(error, rawLine);
      }
    }
  });
}

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
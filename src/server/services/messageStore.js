import fs from 'node:fs';
import path from 'node:path';

export class MessageStore {
  constructor({ messageLogFile, recentLimit }) {
    this.messageLogFile = messageLogFile;
    this.recentLimit = recentLimit;
    this.totalMessages = 0;
    this.recentMessages = [];

    fs.mkdirSync(path.dirname(messageLogFile), { recursive: true });
  }

  record(event) {
    const entry = {
      receivedAt: new Date().toISOString(),
      ...event,
    };

    this.totalMessages += 1;
    this.recentMessages.push(entry);

    if (this.recentMessages.length > this.recentLimit) {
      this.recentMessages.shift();
    }

    fs.appendFileSync(this.messageLogFile, `${JSON.stringify(entry)}\n`, 'utf8');

    return entry;
  }

  getStats() {
    return {
      messageCount: this.totalMessages,
      recentMessages: [...this.recentMessages],
    };
  }
}

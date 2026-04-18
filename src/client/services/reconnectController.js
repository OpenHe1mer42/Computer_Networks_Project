export class ReconnectController {
  constructor({ delayMs }) {
    this.delayMs = delayMs;
    this.timer = null;
  }

  schedule(task) {
    if (this.timer) {
      return false;
    }

    this.timer = setTimeout(async () => {
      this.timer = null;
      await task();
    }, this.delayMs);

    return true;
  }

  clear() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

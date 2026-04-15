import { EventEmitter } from 'node:events';
import net from 'node:net';

import { attachJsonLineParser, sendFrame } from '../../shared/protocol.js';
import { ReconnectController } from '../services/reconnectController.js';

export class TcpClient extends EventEmitter {
  constructor({
    host,
    port,
    handshake,
    reconnectDelayMs,
    reconnectEnabled = true,
  }) {
    super();
    this.host = host;
    this.port = port;
    this.handshake = handshake;
    this.reconnectEnabled = reconnectEnabled;
    this.reconnectAttempts = 0;
    this.manualDisconnect = false;
    this.isConnected = false;
    this.pendingFrames = [];
    this.socket = null;
    this.reconnectController = new ReconnectController({ delayMs: reconnectDelayMs });
  }

  connect() {
    this.manualDisconnect = false;
    this.reconnectController.clear();

    const socket = net.createConnection({
      host: this.host,
      port: this.port,
    });

    this.socket = socket;
    this.isConnected = false;
    socket.setEncoding('utf8');

    socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      sendFrame(socket, {
        type: 'hello',
        ...this.handshake,
      });
      this.flushPendingFrames();
      this.emit('connected');
    });

    attachJsonLineParser(socket, {
      onFrame: (frame) => {
        this.emit('frame', frame);
      },
      onParseError: (error, rawLine) => {
        this.emit('error', new Error(`Failed to parse server frame: ${rawLine}. ${error.message}`));
      },
    });

    socket.on('error', (error) => {
      this.emit('error', error);
    });

    socket.on('close', () => {
      this.isConnected = false;
      this.emit('disconnected', {
        reconnecting: !this.manualDisconnect && this.reconnectEnabled,
      });

      if (!this.manualDisconnect && this.reconnectEnabled) {
        this.reconnectAttempts += 1;
        const scheduled = this.reconnectController.schedule(async () => {
          this.emit('reconnect_scheduled', {
            attempt: this.reconnectAttempts,
          });
          this.connect();
        });

        if (!scheduled) {
          return;
        }
      }
    });
  }

  send(frame) {
    if (!this.socket || this.socket.destroyed || !this.isConnected) {
      this.pendingFrames.push(frame);
      return true;
    }

    sendFrame(this.socket, frame);
    return true;
  }

  flushPendingFrames() {
    if (!this.socket || this.socket.destroyed || this.pendingFrames.length === 0) {
      return;
    }

    for (const frame of this.pendingFrames) {
      sendFrame(this.socket, frame);
    }

    this.pendingFrames = [];
  }

  disconnect() {
    this.manualDisconnect = true;
    this.isConnected = false;
    this.reconnectController.clear();
    this.pendingFrames = [];

    if (this.socket && !this.socket.destroyed) {
      this.socket.end();
      this.socket.destroy();
    }
  }
}
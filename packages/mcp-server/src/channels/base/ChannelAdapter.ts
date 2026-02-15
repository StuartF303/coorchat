/**
 * ChannelAdapter - Base class for channel implementations
 *
 * Provides common functionality:
 * - Reconnection logic with exponential backoff
 * - Error handling and recovery
 * - Message handler management
 * - Statistics tracking
 * - Heartbeat mechanism
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Channel,
  ChannelConfig,
  ChannelStats,
  ConnectionStatus,
  MessageHandler,
  ErrorHandler,
  ConnectionStateHandler,
} from './Channel.js';
import { Message } from '../../protocol/Message.js';
import type { Logger } from '../../logging/Logger.js';
import { createLogger } from '../../logging/Logger.js';

/**
 * Abstract base class for channel implementations
 */
export abstract class ChannelAdapter implements Channel {
  public readonly id: string;
  public readonly type: string;
  protected config: ChannelConfig;
  protected logger: Logger;
  protected _status: ConnectionStatus;
  protected stats: ChannelStats;
  protected messageHandlers: Set<MessageHandler>;
  protected errorHandlers: Set<ErrorHandler>;
  protected stateChangeHandlers: Set<ConnectionStateHandler>;
  protected reconnectAttempts: number;
  protected reconnectTimer?: NodeJS.Timeout;
  protected heartbeatTimer?: NodeJS.Timeout;
  protected connectionStartTime?: Date;

  constructor(config: ChannelConfig) {
    this.id = uuidv4();
    this.type = config.type;
    this.config = config;
    this.logger = createLogger();
    this._status = ConnectionStatus.DISCONNECTED;
    this.reconnectAttempts = 0;
    this.messageHandlers = new Set();
    this.errorHandlers = new Set();
    this.stateChangeHandlers = new Set();
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      messagesFailed: 0,
      bytesTransferred: 0,
      uptime: 0,
    };

    // Validate authentication token
    this.validateToken();
  }

  /**
   * Validate authentication token
   */
  protected validateToken(): void {
    if (!this.config.token || this.config.token.length < 16) {
      throw new Error('Invalid or missing authentication token (minimum 16 characters)');
    }
  }

  /**
   * Verify token matches expected value
   */
  protected verifyToken(providedToken: string): boolean {
    // Use timing-safe comparison to prevent timing attacks
    if (!providedToken || !this.config.token) {
      return false;
    }

    // Convert to buffers for timing-safe comparison
    const providedBuffer = Buffer.from(providedToken);
    const expectedBuffer = Buffer.from(this.config.token);

    // Lengths must match
    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    // Timing-safe comparison
    let result = 0;
    for (let i = 0; i < providedBuffer.length; i++) {
      result |= providedBuffer[i] ^ expectedBuffer[i];
    }

    return result === 0;
  }

  /**
   * Get authentication token for outbound connections
   */
  protected getAuthToken(): string {
    return this.config.token;
  }

  /**
   * Get current connection status
   */
  get status(): ConnectionStatus {
    return this._status;
  }

  /**
   * Set connection status and notify handlers
   */
  protected setStatus(newStatus: ConnectionStatus): void {
    const previousStatus = this._status;
    if (previousStatus === newStatus) {
      return;
    }

    this._status = newStatus;

    // Update connection start time
    if (newStatus === ConnectionStatus.CONNECTED) {
      this.connectionStartTime = new Date();
      this.reconnectAttempts = 0;
    }

    // Notify state change handlers
    this.stateChangeHandlers.forEach((handler) => {
      this.safeCall(handler, newStatus, previousStatus);
    });
  }

  /**
   * Connect to the channel (with retry logic)
   */
  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    this.setStatus(ConnectionStatus.CONNECTING);

    try {
      await this.doConnect();
      this.setStatus(ConnectionStatus.CONNECTED);
      this.startHeartbeat();
    } catch (error) {
      this.setStatus(ConnectionStatus.FAILED);
      this.handleError(
        error instanceof Error
          ? error
          : new Error(`Connection failed: ${String(error)}`)
      );

      // Attempt reconnection if configured
      if (this.config.retry?.enabled) {
        await this.scheduleReconnect();
      } else {
        throw error;
      }
    }
  }

  /**
   * Disconnect from the channel
   */
  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this._status === ConnectionStatus.DISCONNECTED) {
      return;
    }

    try {
      await this.doDisconnect();
    } finally {
      this.setStatus(ConnectionStatus.DISCONNECTED);
      this.connectionStartTime = undefined;
    }
  }

  /**
   * Send a message through the channel
   */
  async sendMessage(message: Message): Promise<void> {
    if (!this.isConnected()) {
      throw new Error(`Cannot send message: channel is ${this._status}`);
    }

    try {
      // Route message based on recipient
      await this.routeMessage(message);
      this.stats.messagesSent++;
      this.stats.bytesTransferred += this.estimateMessageSize(message);
    } catch (error) {
      this.stats.messagesFailed++;
      this.handleError(
        error instanceof Error
          ? error
          : new Error(`Failed to send message: ${String(error)}`)
      );
      throw error;
    }
  }

  /**
   * Route message (broadcast vs unicast)
   */
  protected async routeMessage(message: Message): Promise<void> {
    if (this.isBroadcast(message)) {
      // Broadcast message to all participants
      await this.broadcastMessage(message);
    } else {
      // Unicast message to specific recipient
      await this.unicastMessage(message);
    }
  }

  /**
   * Check if message is a broadcast
   */
  protected isBroadcast(message: Message): boolean {
    return !message.recipientId || message.recipientId === null;
  }

  /**
   * Broadcast message to all participants
   */
  protected async broadcastMessage(message: Message): Promise<void> {
    // Default implementation: send to channel (all subscribers receive it)
    await this.doSendMessage(message);
  }

  /**
   * Unicast message to specific recipient
   */
  protected async unicastMessage(message: Message): Promise<void> {
    // Default implementation: still send to channel
    // Subclasses can override for direct messaging if supported
    await this.doSendMessage(message);
  }

  /**
   * Register a message handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Register an error handler
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * Register a connection state change handler
   */
  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.stateChangeHandlers.add(handler);
    return () => this.stateChangeHandlers.delete(handler);
  }

  /**
   * Get channel statistics
   */
  getStats(): ChannelStats {
    return {
      ...this.stats,
      uptime: this.connectionStartTime
        ? Date.now() - this.connectionStartTime.getTime()
        : 0,
    };
  }

  /**
   * Check if channel is connected
   */
  isConnected(): boolean {
    return this._status === ConnectionStatus.CONNECTED;
  }

  /**
   * Retrieve message history (default: not supported)
   */
  async getHistory(_limit?: number, _before?: Date): Promise<Message[]> {
    return [];
  }

  /**
   * Ping the channel (default implementation)
   */
  async ping(): Promise<number> {
    const start = Date.now();
    await this.doPing();
    return Date.now() - start;
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  protected abstract doConnect(): Promise<void>;
  protected abstract doDisconnect(): Promise<void>;
  protected abstract doSendMessage(message: Message): Promise<void>;
  protected abstract doPing(): Promise<void>;

  /**
   * Handle received message
   */
  protected handleMessage(message: Message): void {
    this.stats.messagesReceived++;
    this.stats.bytesTransferred += this.estimateMessageSize(message);

    this.messageHandlers.forEach((handler) => {
      this.safeCall(handler, message);
    });
  }

  /**
   * Handle error
   */
  protected handleError(error: Error): void {
    this.stats.lastError = error.message;

    this.errorHandlers.forEach((handler) => {
      this.safeCall(handler, error);
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  protected async scheduleReconnect(): Promise<void> {
    if (!this.config.retry?.enabled) {
      return;
    }

    this.clearReconnectTimer();

    if (this.reconnectAttempts >= (this.config.retry.maxAttempts || 5)) {
      this.handleError(
        new Error('Max reconnection attempts reached, giving up')
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = this.calculateBackoff();

    this.setStatus(ConnectionStatus.RECONNECTING);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        // connect() already handles retry
      }
    }, delay);
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  protected calculateBackoff(): number {
    const { initialDelayMs = 1000, maxDelayMs = 60000 } = this.config.retry || {};
    const exponentialDelay = initialDelayMs * Math.pow(2, this.reconnectAttempts - 1);
    const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
    return Math.min(exponentialDelay + jitter, maxDelayMs);
  }

  /**
   * Clear reconnect timer
   */
  protected clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Start heartbeat mechanism
   */
  protected startHeartbeat(): void {
    if (!this.config.heartbeat?.enabled) {
      return;
    }

    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat().catch((error) => {
        this.handleError(
          error instanceof Error
            ? error
            : new Error(`Heartbeat failed: ${String(error)}`)
        );
      });
    }, this.config.heartbeat.intervalMs || 15000);
  }

  /**
   * Stop heartbeat mechanism
   */
  protected stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Send heartbeat (can be overridden by subclasses)
   */
  protected async sendHeartbeat(): Promise<void> {
    try {
      await this.ping();
      this.stats.lastHeartbeat = new Date();
    } catch (error) {
      // Heartbeat failed, trigger reconnection if needed
      if (this.config.retry?.enabled) {
        await this.scheduleReconnect();
      }
      throw error;
    }
  }

  /**
   * Estimate message size in bytes
   */
  protected estimateMessageSize(message: Message): number {
    return JSON.stringify(message).length;
  }

  /**
   * Safely call a handler with error protection
   */
  protected safeCall<T extends unknown[]>(
    handler: (...args: T) => void | Promise<void>,
    ...args: T
  ): void {
    try {
      const result = handler(...args);
      if (result instanceof Promise) {
        result.catch((error) => {
          console.error('Handler error:', error);
        });
      }
    } catch (error) {
      console.error('Handler error:', error);
    }
  }
}

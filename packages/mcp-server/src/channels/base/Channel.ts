/**
 * Channel - Base interface for all communication channels
 *
 * Defines the contract for Discord, SignalR, Redis, and Relay channel implementations
 */

import { Message } from '../../protocol/Message.js';

/**
 * Channel connection status
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

/**
 * Channel configuration
 */
export interface ChannelConfig {
  /** Channel type identifier */
  type: 'discord' | 'signalr' | 'redis' | 'relay';

  /** Authentication token */
  token: string;

  /** Channel-specific connection parameters */
  connectionParams: Record<string, unknown>;

  /** Retry configuration */
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
  };

  /** Heartbeat configuration */
  heartbeat?: {
    enabled: boolean;
    intervalMs: number;
    timeoutMs: number;
  };
}

/**
 * Channel statistics
 */
export interface ChannelStats {
  messagesSent: number;
  messagesReceived: number;
  messagesFailed: number;
  bytesTransferred: number;
  uptime: number;
  lastHeartbeat?: Date;
  lastError?: string;
}

/**
 * Message handler callback
 */
export type MessageHandler = (message: Message) => void | Promise<void>;

/**
 * Error handler callback
 */
export type ErrorHandler = (error: Error) => void | Promise<void>;

/**
 * Connection state change callback
 */
export type ConnectionStateHandler = (
  status: ConnectionStatus,
  previousStatus: ConnectionStatus
) => void | Promise<void>;

/**
 * Base Channel interface
 * All channel implementations must implement this interface
 */
export interface Channel {
  /**
   * Get channel unique identifier
   */
  readonly id: string;

  /**
   * Get channel type
   */
  readonly type: string;

  /**
   * Get current connection status
   */
  readonly status: ConnectionStatus;

  /**
   * Connect to the channel
   * @throws Error if connection fails
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the channel
   */
  disconnect(): Promise<void>;

  /**
   * Send a message through the channel
   * @param message - Message to send
   * @returns Promise that resolves when message is sent
   * @throws Error if send fails
   */
  sendMessage(message: Message): Promise<void>;

  /**
   * Register a message handler
   * @param handler - Function to call when a message is received
   * @returns Function to unregister the handler
   */
  onMessage(handler: MessageHandler): () => void;

  /**
   * Register an error handler
   * @param handler - Function to call when an error occurs
   * @returns Function to unregister the handler
   */
  onError(handler: ErrorHandler): () => void;

  /**
   * Register a connection state change handler
   * @param handler - Function to call when connection state changes
   * @returns Function to unregister the handler
   */
  onConnectionStateChange(handler: ConnectionStateHandler): () => void;

  /**
   * Get channel statistics
   */
  getStats(): ChannelStats;

  /**
   * Check if channel is connected
   */
  isConnected(): boolean;

  /**
   * Retrieve message history (if supported by channel)
   * @param limit - Maximum number of messages to retrieve
   * @param before - Retrieve messages before this timestamp
   * @returns Array of messages (empty if not supported)
   */
  getHistory(limit?: number, before?: Date): Promise<Message[]>;

  /**
   * Ping the channel to check connectivity
   * @returns Round-trip time in milliseconds
   * @throws Error if ping fails
   */
  ping(): Promise<number>;
}

/**
 * Type guard to check if an object implements the Channel interface
 */
export function isChannel(obj: unknown): obj is Channel {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const channel = obj as Partial<Channel>;

  return (
    typeof channel.id === 'string' &&
    typeof channel.type === 'string' &&
    typeof channel.status === 'string' &&
    typeof channel.connect === 'function' &&
    typeof channel.disconnect === 'function' &&
    typeof channel.sendMessage === 'function' &&
    typeof channel.onMessage === 'function' &&
    typeof channel.onError === 'function' &&
    typeof channel.isConnected === 'function'
  );
}

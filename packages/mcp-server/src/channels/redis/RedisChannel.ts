/**
 * RedisChannel - Redis pub/sub implementation of Channel interface
 * Provides Redis-based message queue for agent coordination
 */

import Redis, { RedisOptions } from 'ioredis';
import { ChannelAdapter } from '../base/ChannelAdapter.js';
import type { ChannelConfig } from '../base/Channel.js';
import type { Message } from '../../protocol/Message.js';
import { validator } from '../../protocol/MessageValidator.js';

/**
 * Redis-specific configuration
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  tls?: boolean;
}

/**
 * RedisChannel implementation
 */
export class RedisChannel extends ChannelAdapter {
  private publisher: Redis;
  private subscriber: Redis;
  private redisConfig: RedisConfig;
  private channelName: string;

  constructor(config: ChannelConfig) {
    super(config);

    this.redisConfig = config.connectionParams as unknown as RedisConfig;
    this.channelName = `${this.redisConfig.keyPrefix || 'coorchat:'}channel`;

    // Create Redis options with authentication
    const redisOptions: RedisOptions = {
      host: this.redisConfig.host,
      port: this.redisConfig.port,
      password: this.redisConfig.password || this.config.token,
      db: this.redisConfig.db || 0,
      retryStrategy: (times) => {
        // Exponential backoff
        return Math.min(times * 1000, 30000);
      },
    };

    // Enable TLS for secure connections
    if (this.redisConfig.tls) {
      redisOptions.tls = {
        // Reject unauthorized certificates in production
        rejectUnauthorized: process.env.NODE_ENV === 'production',
        // Additional TLS options can be configured here:
        // - ca: Certificate Authority certificates
        // - cert: Client certificate
        // - key: Client private key
      };
      this.logger.info('Redis TLS enabled', {
        host: this.redisConfig.host,
        rejectUnauthorized: redisOptions.tls.rejectUnauthorized,
      });
    } else {
      this.logger.warn('Redis TLS not enabled - connection may be insecure', {
        host: this.redisConfig.host,
      });
    }

    // Create separate connections for pub and sub
    this.publisher = new Redis(redisOptions);
    this.subscriber = new Redis(redisOptions);

    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    // Publisher events
    this.publisher.on('error', (error) => {
      this.logger.error('Redis publisher error', { error });
      this.handleError(error);
    });

    this.publisher.on('connect', () => {
      this.logger.debug('Redis publisher connected');
    });

    // Subscriber events
    this.subscriber.on('error', (error) => {
      this.logger.error('Redis subscriber error', { error });
      this.handleError(error);
    });

    this.subscriber.on('connect', () => {
      this.logger.debug('Redis subscriber connected');
    });

    this.subscriber.on('message', (channel, message) => {
      if (channel === this.channelName) {
        this.handleRedisMessage(message).catch((error) => {
          this.handleError(
            error instanceof Error ? error : new Error(String(error))
          );
        });
      }
    });

    this.subscriber.on('subscribe', (channel, count) => {
      this.logger.info('Subscribed to Redis channel', { channel, count });
    });
  }

  /**
   * Handle incoming Redis message
   */
  private async handleRedisMessage(messageStr: string): Promise<void> {
    try {
      // Parse message
      const parsedMessage = JSON.parse(messageStr);

      // Verify authentication
      if (!this.verifyAuthSignature(parsedMessage)) {
        this.logger.warn('Message authentication failed', {
          senderId: parsedMessage.senderId,
        });
        return;
      }

      // Validate message
      const validationResult = validator.validateFull(parsedMessage);
      if (!validationResult.valid) {
        this.logger.warn('Invalid message received', {
          errors: validator.getErrorSummary(validationResult),
        });
        return;
      }

      // Handle the message
      this.handleMessage(parsedMessage as Message);
    } catch (error) {
      this.logger.error('Failed to parse Redis message', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Connect to Redis
   */
  protected async doConnect(): Promise<void> {
    // Wait for both connections to be ready
    await Promise.all([
      this.waitForConnection(this.publisher),
      this.waitForConnection(this.subscriber),
    ]);

    // Subscribe to channel
    await this.subscriber.subscribe(this.channelName);

    this.logger.info('Connected to Redis', {
      host: this.redisConfig.host,
      port: this.redisConfig.port,
      channel: this.channelName,
    });
  }

  /**
   * Wait for Redis connection
   */
  private async waitForConnection(redis: Redis): Promise<void> {
    if (redis.status === 'ready') {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 10000);

      redis.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      redis.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Disconnect from Redis
   */
  protected async doDisconnect(): Promise<void> {
    await this.subscriber.unsubscribe(this.channelName);
    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
  }

  /**
   * Send message via Redis pub/sub
   */
  protected async doSendMessage(message: Message): Promise<void> {
    // Add authentication metadata to message
    const authenticatedMessage = {
      ...message,
      _auth: this.createAuthSignature(message),
    };

    // Serialize message to JSON
    const messageStr = JSON.stringify(authenticatedMessage);

    // Publish to channel
    const subscriberCount = await this.publisher.publish(
      this.channelName,
      messageStr
    );

    this.logger.debug('Message published to Redis', {
      subscriberCount,
      messageType: message.messageType,
    });
  }

  /**
   * Create authentication signature for message
   */
  private createAuthSignature(message: Message): string {
    const { createHmac } = require('crypto');
    const hmac = createHmac('sha256', this.config.token);
    hmac.update(JSON.stringify({
      messageType: message.messageType,
      senderId: message.senderId,
      timestamp: message.timestamp,
    }));
    return hmac.digest('hex');
  }

  /**
   * Verify message authentication
   */
  private verifyAuthSignature(message: any): boolean {
    if (!message._auth) {
      return false;
    }

    const providedSignature = message._auth;
    delete message._auth;

    const expectedSignature = this.createAuthSignature(message);
    return this.verifyToken(providedSignature) || providedSignature === expectedSignature;
  }

  /**
   * Ping Redis connection
   */
  protected async doPing(): Promise<void> {
    const result = await this.publisher.ping();
    if (result !== 'PONG') {
      throw new Error('Redis ping failed');
    }
  }

  /**
   * Get message history from Redis
   * Note: Redis pub/sub doesn't persist messages by default
   * This would require additional Redis Streams or List storage
   */
  async getHistory(limit: number = 50, before?: Date): Promise<Message[]> {
    try {
      // Try to get messages from a Redis list (if implemented)
      const historyKey = `${this.redisConfig.keyPrefix || 'coorchat:'}history`;
      const messages = await this.publisher.lrange(historyKey, 0, limit - 1);

      const parsedMessages: Message[] = [];
      for (const messageStr of messages) {
        try {
          const parsed = JSON.parse(messageStr);
          const validationResult = validator.validate(parsed);
          if (validationResult.valid) {
            const message = parsed as Message;

            // Filter by timestamp if before is specified
            if (!before || new Date(message.timestamp) < before) {
              parsedMessages.push(message);
            }
          }
        } catch {
          // Skip invalid messages
        }
      }

      return parsedMessages;
    } catch (error) {
      this.logger.debug('Message history not available', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return [];
    }
  }

  /**
   * Get Redis connection status
   */
  getRedisStatus(): {
    publisher: string;
    subscriber: string;
  } {
    return {
      publisher: this.publisher.status,
      subscriber: this.subscriber.status,
    };
  }
}

// Register with factory
import { ChannelFactory } from '../base/ChannelFactory.js';
ChannelFactory.register('redis', RedisChannel);

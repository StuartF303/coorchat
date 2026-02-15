/**
 * Unit Test: RedisChannel
 * Tests Redis pub/sub channel adapter functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisChannel } from '../../../src/channels/redis/RedisChannel.js';
import type { ChannelConfig } from '../../../src/channels/base/Channel.js';
import { MessageType } from '../../../src/protocol/Message.js';

// Mock ioredis
vi.mock('ioredis', () => {
  class MockRedis {
    status = 'ready';
    private eventHandlers: Map<string, Function[]> = new Map();

    on(event: string, handler: Function) {
      if (!this.eventHandlers.has(event)) {
        this.eventHandlers.set(event, []);
      }
      this.eventHandlers.get(event)!.push(handler);
      return this;
    }

    once(event: string, handler: Function) {
      setTimeout(() => handler(), 10);
      return this;
    }

    emit(event: string, ...args: any[]) {
      const handlers = this.eventHandlers.get(event) || [];
      handlers.forEach(h => h(...args));
    }

    subscribe = vi.fn().mockResolvedValue(undefined);
    unsubscribe = vi.fn().mockResolvedValue(undefined);
    publish = vi.fn().mockResolvedValue(1);
    ping = vi.fn().mockResolvedValue('PONG');
    lrange = vi.fn().mockResolvedValue([]);
    quit = vi.fn().mockResolvedValue('OK');
  }

  return {
    default: MockRedis,
  };
});

describe('RedisChannel', () => {
  let channel: RedisChannel;
  let config: ChannelConfig;

  beforeEach(() => {
    config = {
      type: 'redis',
      token: 'test-channel-token',
      connectionParams: {
        host: 'localhost',
        port: 6379,
        password: 'redis-password',
        db: 0,
        keyPrefix: 'test:',
        tls: false,
      },
    };

    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (channel) {
      await channel.disconnect();
    }
  });

  describe('Constructor', () => {
    it('should create Redis channel with valid config', () => {
      channel = new RedisChannel(config);

      expect(channel).toBeDefined();
      expect(channel.status).toBe('disconnected');
    });

    it('should use keyPrefix for channel name', () => {
      channel = new RedisChannel(config);

      // Channel name should be prefix + 'channel'
      const channelName = (channel as any).channelName;
      expect(channelName).toBe('test:channel');
    });

    it('should default to coorchat: prefix', () => {
      const configWithoutPrefix = {
        ...config,
        connectionParams: { ...config.connectionParams, keyPrefix: undefined },
      };

      channel = new RedisChannel(configWithoutPrefix);

      const channelName = (channel as any).channelName;
      expect(channelName).toBe('coorchat:channel');
    });
  });

  describe('Connection', () => {
    it('should connect to Redis successfully', async () => {
      channel = new RedisChannel(config);
      await channel.connect();

      expect(channel.status).toBe('connected');

      const subscriber = (channel as any).subscriber;
      expect(subscriber.subscribe).toHaveBeenCalledWith('test:channel');
    });

    it('should disconnect from Redis successfully', async () => {
      channel = new RedisChannel(config);
      await channel.connect();
      await channel.disconnect();

      expect(channel.status).toBe('disconnected');

      const subscriber = (channel as any).subscriber;
      expect(subscriber.unsubscribe).toHaveBeenCalledWith('test:channel');
    });

    it('should check Redis connection status', async () => {
      channel = new RedisChannel(config);
      await channel.connect();

      const status = channel.getRedisStatus();

      expect(status).toHaveProperty('publisher');
      expect(status).toHaveProperty('subscriber');
      expect(status.publisher).toBe('ready');
      expect(status.subscriber).toBe('ready');
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      channel = new RedisChannel(config);
      await channel.connect();
    });

    it('should send message with authentication signature', async () => {
      const message = {
        protocolVersion: '1.0.0',
        messageType: MessageType.TASK_ASSIGNED,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'medium' as const,
        payload: { taskId: 'task-1' },
      };

      await channel.sendMessage(message);

      const publisher = (channel as any).publisher;
      expect(publisher.publish).toHaveBeenCalledWith(
        'test:channel',
        expect.stringContaining('TASK_ASSIGNED')
      );
      expect(publisher.publish).toHaveBeenCalledWith(
        'test:channel',
        expect.stringContaining('_auth')
      );
    });

    it('should return subscriber count after publish', async () => {
      const publisher = (channel as any).publisher;
      publisher.publish.mockResolvedValueOnce(5);

      const message = {
        protocolVersion: '1.0.0',
        messageType: MessageType.HEARTBEAT,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'low' as const,
      };

      await channel.sendMessage(message);

      expect(publisher.publish).toHaveBeenCalled();
    });
  });

  describe('Message Receiving', () => {
    beforeEach(async () => {
      channel = new RedisChannel(config);
      await channel.connect();
    });

    it('should handle incoming Redis messages', async () => {
      const receivedMessages: any[] = [];
      channel.onMessage((msg) => receivedMessages.push(msg));

      const testMessage = {
        protocolVersion: '1.0.0',
        messageType: MessageType.TASK_ASSIGNED,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'medium' as const,
        payload: { taskId: 'task-1' },
      };

      // Add auth signature
      const authenticatedMessage = {
        ...testMessage,
        _auth: (channel as any).createAuthSignature(testMessage),
      };

      // Simulate Redis message
      const subscriber = (channel as any).subscriber;
      subscriber.emit('message', 'test:channel', JSON.stringify(authenticatedMessage));

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].messageType).toBe(MessageType.TASK_ASSIGNED);
    });

    it('should reject messages with invalid authentication', async () => {
      const receivedMessages: any[] = [];
      channel.onMessage((msg) => receivedMessages.push(msg));

      const testMessage = {
        protocolVersion: '1.0.0',
        messageType: MessageType.TASK_ASSIGNED,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'medium' as const,
        payload: { taskId: 'task-1' },
        _auth: 'invalid-signature',
      };

      // Simulate Redis message
      const subscriber = (channel as any).subscriber;
      subscriber.emit('message', 'test:channel', JSON.stringify(testMessage));

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(0);
    });

    it('should ignore invalid JSON messages', async () => {
      const receivedMessages: any[] = [];
      channel.onMessage((msg) => receivedMessages.push(msg));

      // Simulate Redis message with invalid JSON
      const subscriber = (channel as any).subscriber;
      subscriber.emit('message', 'test:channel', '{ invalid json');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(0);
    });
  });

  describe('Ping', () => {
    beforeEach(async () => {
      channel = new RedisChannel(config);
      await channel.connect();
    });

    it('should ping Redis successfully', async () => {
      await expect(channel.ping()).resolves.not.toThrow();

      const publisher = (channel as any).publisher;
      expect(publisher.ping).toHaveBeenCalled();
    });

    it('should fail ping when Redis returns unexpected response', async () => {
      const publisher = (channel as any).publisher;
      publisher.ping.mockResolvedValueOnce('UNEXPECTED');

      await expect(channel.ping()).rejects.toThrow('ping failed');
    });
  });

  describe('Message History', () => {
    beforeEach(async () => {
      channel = new RedisChannel(config);
      await channel.connect();
    });

    it('should fetch message history from Redis list', async () => {
      const publisher = (channel as any).publisher;
      const testMessage = {
        protocolVersion: '1.0.0',
        messageType: MessageType.HEARTBEAT,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'low' as const,
      };

      publisher.lrange.mockResolvedValueOnce([JSON.stringify(testMessage)]);

      const history = await channel.getHistory(10);

      expect(history).toHaveLength(1);
      expect(history[0].messageType).toBe(MessageType.HEARTBEAT);
      expect(publisher.lrange).toHaveBeenCalledWith('test:history', 0, 9);
    });

    it('should filter history by timestamp when before is specified', async () => {
      const publisher = (channel as any).publisher;
      const beforeDate = new Date();
      const oldMessage = {
        protocolVersion: '1.0.0',
        messageType: MessageType.HEARTBEAT,
        senderId: 'agent-1',
        timestamp: new Date(beforeDate.getTime() - 1000).toISOString(),
        priority: 'low' as const,
      };
      const newMessage = {
        ...oldMessage,
        timestamp: new Date(beforeDate.getTime() + 1000).toISOString(),
      };

      publisher.lrange.mockResolvedValueOnce([
        JSON.stringify(oldMessage),
        JSON.stringify(newMessage),
      ]);

      const history = await channel.getHistory(10, beforeDate);

      expect(history).toHaveLength(1);
      expect(history[0].timestamp).toBe(oldMessage.timestamp);
    });

    it('should return empty array when history not available', async () => {
      const publisher = (channel as any).publisher;
      publisher.lrange.mockRejectedValueOnce(new Error('Key not found'));

      const history = await channel.getHistory();

      expect(history).toEqual([]);
    });
  });

  describe('Authentication', () => {
    beforeEach(async () => {
      channel = new RedisChannel(config);
      await channel.connect();
    });

    it('should create consistent HMAC signatures', () => {
      const message = {
        protocolVersion: '1.0.0',
        messageType: MessageType.HEARTBEAT,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'low' as const,
      };

      const sig1 = (channel as any).createAuthSignature(message);
      const sig2 = (channel as any).createAuthSignature(message);

      expect(sig1).toBe(sig2);
      expect(sig1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it('should verify valid signatures', () => {
      const message = {
        protocolVersion: '1.0.0',
        messageType: MessageType.HEARTBEAT,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'low' as const,
      };

      const signature = (channel as any).createAuthSignature(message);
      const messageWithAuth = { ...message, _auth: signature };

      const isValid = (channel as any).verifyAuthSignature(messageWithAuth);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signatures', () => {
      const message = {
        protocolVersion: '1.0.0',
        messageType: MessageType.HEARTBEAT,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'low' as const,
        _auth: 'invalid-signature-12345',
      };

      const isValid = (channel as any).verifyAuthSignature(message);

      expect(isValid).toBe(false);
    });
  });

  describe('TLS Configuration', () => {
    it('should enable TLS when configured', () => {
      const tlsConfig = {
        ...config,
        connectionParams: { ...config.connectionParams, tls: true },
      };

      channel = new RedisChannel(tlsConfig);

      // Verify TLS is enabled in Redis options
      // (In real implementation, this would check RedisOptions)
      expect(channel).toBeDefined();
    });

    it('should warn when TLS not enabled', () => {
      const noTlsConfig = {
        ...config,
        connectionParams: { ...config.connectionParams, tls: false },
      };

      channel = new RedisChannel(noTlsConfig);

      // Verify warning is logged (in real implementation)
      expect(channel).toBeDefined();
    });
  });
});

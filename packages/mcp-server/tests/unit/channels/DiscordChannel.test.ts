/**
 * Unit Test: DiscordChannel
 * Tests Discord.js channel adapter functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiscordChannel } from '../../../src/channels/discord/DiscordChannel.js';
import type { ChannelConfig } from '../../../src/channels/base/Channel.js';
import { MessageType } from '../../../src/protocol/Message.js';
import { Client, TextChannel, Message as DiscordMessage } from 'discord.js';

// Mock Discord.js
vi.mock('discord.js', () => {
  const mockTextChannel = {
    id: 'channel-123',
    send: vi.fn().mockResolvedValue(undefined),
    messages: {
      fetch: vi.fn().mockResolvedValue(new Map()),
    },
    isTextBased: () => true,
  };

  const mockClient = {
    login: vi.fn().mockResolvedValue('token'),
    destroy: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
    ws: { ping: 50 },
    user: { id: 'bot-123', tag: 'TestBot#0001' },
    channels: {
      fetch: vi.fn().mockResolvedValue(mockTextChannel),
    },
    on: vi.fn(),
    once: vi.fn((event: string, handler: Function) => {
      if (event === 'ready') {
        setTimeout(() => handler(), 10);
      }
    }),
  };

  return {
    Client: vi.fn(() => mockClient),
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      MessageContent: 4,
    },
    TextChannel: vi.fn(),
    Message: vi.fn(),
  };
});

describe('DiscordChannel', () => {
  let channel: DiscordChannel;
  let config: ChannelConfig;

  beforeEach(() => {
    config = {
      type: 'discord',
      token: 'test-channel-token',
      connectionParams: {
        guildId: 'guild-123',
        channelId: 'channel-123',
        botToken: 'bot-token-123',
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
    it('should create Discord channel with valid config', () => {
      channel = new DiscordChannel(config);

      expect(channel).toBeDefined();
      expect(channel.status).toBe('disconnected');
    });

    it('should setup event handlers on construction', () => {
      channel = new DiscordChannel(config);

      // Verify Client.on was called for event setup
      expect(Client).toHaveBeenCalled();
    });
  });

  describe('Connection', () => {
    it('should connect to Discord successfully', async () => {
      channel = new DiscordChannel(config);
      await channel.connect();

      expect(channel.status).toBe('connected');
    });

    it('should disconnect from Discord successfully', async () => {
      channel = new DiscordChannel(config);
      await channel.connect();
      await channel.disconnect();

      expect(channel.status).toBe('disconnected');
    });

    it('should throw error if channel not found', async () => {
      channel = new DiscordChannel(config);

      const mockClient = (channel as any).client;
      mockClient.channels.fetch.mockResolvedValueOnce(null);

      await expect(channel.connect()).rejects.toThrow('Channel not found');
    });

    it('should throw error if not text channel', async () => {
      channel = new DiscordChannel(config);

      const mockClient = (channel as any).client;
      const mockChannel = {
        isTextBased: () => false,
      };
      mockClient.channels.fetch.mockResolvedValueOnce(mockChannel);

      await expect(channel.connect()).rejects.toThrow('not a text channel');
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      channel = new DiscordChannel(config);
      await channel.connect();
    });

    it('should send message to Discord channel', async () => {
      const message = {
        protocolVersion: '1.0',
        messageType: MessageType.TASK_ASSIGNED,
        senderId: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: new Date().toISOString(),
        priority: 5,
        payload: { taskId: 'task-1' },
      };

      await channel.sendMessage(message);

      const mockClient = (channel as any).client;
      const mockTextChannel = await mockClient.channels.fetch();

      expect(mockTextChannel.send).toHaveBeenCalledWith(
        expect.stringContaining('task_assigned')
      );
    });

    it('should reject message exceeding 2000 character limit', async () => {
      const largePayload = 'x'.repeat(2100);
      const message = {
        protocolVersion: '1.0',
        messageType: MessageType.TASK_ASSIGNED,
        senderId: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: new Date().toISOString(),
        priority: 5,
        payload: { data: largePayload },
      };

      await expect(channel.sendMessage(message)).rejects.toThrow(
        'Message too long'
      );
    });

    it('should throw error when not connected', async () => {
      await channel.disconnect();

      const message = {
        protocolVersion: '1.0',
        messageType: MessageType.HEARTBEAT,
        senderId: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: new Date().toISOString(),
        priority: 3,
      };

      await expect(channel.sendMessage(message)).rejects.toThrow(
        'channel is disconnected'
      );
    });
  });

  describe('Ping', () => {
    beforeEach(async () => {
      channel = new DiscordChannel(config);
      await channel.connect();
    });

    it('should ping Discord successfully', async () => {
      await expect(channel.ping()).resolves.not.toThrow();
    });

    it('should fail ping when client not ready', async () => {
      const mockClient = (channel as any).client;
      mockClient.isReady.mockReturnValueOnce(false);

      await expect(channel.ping()).rejects.toThrow('client not ready');
    });

    it('should fail ping when websocket disconnected', async () => {
      const mockClient = (channel as any).client;
      mockClient.ws.ping = -1;

      await expect(channel.ping()).rejects.toThrow('websocket not connected');
    });
  });

  describe('Message History', () => {
    beforeEach(async () => {
      channel = new DiscordChannel(config);
      await channel.connect();
    });

    it('should return empty array when not connected', async () => {
      await channel.disconnect();
      const history = await channel.getHistory();

      expect(history).toEqual([]);
    });

    it('should fetch message history', async () => {
      const mockTextChannel = (channel as any).textChannel;
      expect(mockTextChannel).toBeDefined(); // Verify textChannel is set

      const mockMessage = {
        author: { bot: true, id: 'bot-123' },
        content: JSON.stringify({
          protocolVersion: '1.0',
          messageType: MessageType.HEARTBEAT,
          senderId: '550e8400-e29b-41d4-a716-446655440000',
          timestamp: new Date().toISOString(),
          priority: 3,
        }),
      };

      // Clear previous mock calls and set new return value
      mockTextChannel.messages.fetch.mockClear();
      mockTextChannel.messages.fetch.mockResolvedValue(
        new Map([['msg-1', mockMessage]])
      );

      const history = await channel.getHistory(10);

      expect(history).toHaveLength(1);
      expect(history[0].messageType).toBe(MessageType.HEARTBEAT);
    });

    it('should skip invalid JSON messages in history', async () => {
      const mockTextChannel = (channel as any).textChannel;

      const mockMessages = new Map([
        ['msg-1', { author: { bot: true }, content: 'invalid json' }],
        ['msg-2', { author: { bot: true }, content: '{ incomplete json' }],
      ]);

      mockTextChannel.messages.fetch.mockClear();
      mockTextChannel.messages.fetch.mockResolvedValue(mockMessages);

      const history = await channel.getHistory();

      expect(history).toEqual([]);
    });
  });

  describe('Authentication', () => {
    it('should use bot token for authentication', () => {
      channel = new DiscordChannel(config);

      // Access protected method via type assertion
      const token = (channel as any).getAuthToken();

      expect(token).toBe('bot-token-123');
    });
  });
});

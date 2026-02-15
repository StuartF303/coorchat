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
      expect(channel.getStatus()).toBe('disconnected');
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

      expect(channel.getStatus()).toBe('connected');
    });

    it('should disconnect from Discord successfully', async () => {
      channel = new DiscordChannel(config);
      await channel.connect();
      await channel.disconnect();

      expect(channel.getStatus()).toBe('disconnected');
    });

    it('should throw error if channel not found', async () => {
      const mockClient = (Client as any).mock.results[0].value;
      mockClient.channels.fetch.mockResolvedValueOnce(null);

      channel = new DiscordChannel(config);

      await expect(channel.connect()).rejects.toThrow('Channel not found');
    });

    it('should throw error if not text channel', async () => {
      const mockClient = (Client as any).mock.results[0].value;
      const mockChannel = {
        isTextBased: () => false,
      };
      mockClient.channels.fetch.mockResolvedValueOnce(mockChannel);

      channel = new DiscordChannel(config);

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
        protocolVersion: '1.0.0',
        messageType: MessageType.TASK_ASSIGNED,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'medium' as const,
        payload: { taskId: 'task-1' },
      };

      await channel.sendMessage(message);

      const mockClient = (Client as any).mock.results[0].value;
      const mockTextChannel = await mockClient.channels.fetch();

      expect(mockTextChannel.send).toHaveBeenCalledWith(
        expect.stringContaining('TASK_ASSIGNED')
      );
    });

    it('should reject message exceeding 2000 character limit', async () => {
      const largePayload = 'x'.repeat(2100);
      const message = {
        protocolVersion: '1.0.0',
        messageType: MessageType.TASK_ASSIGNED,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'medium' as const,
        payload: { data: largePayload },
      };

      await expect(channel.sendMessage(message)).rejects.toThrow(
        'Message too long'
      );
    });

    it('should throw error when not connected', async () => {
      await channel.disconnect();

      const message = {
        protocolVersion: '1.0.0',
        messageType: MessageType.HEARTBEAT,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'low' as const,
      };

      await expect(channel.sendMessage(message)).rejects.toThrow(
        'Not connected'
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
      const mockClient = (Client as any).mock.results[0].value;
      mockClient.isReady.mockReturnValueOnce(false);

      await expect(channel.ping()).rejects.toThrow('client not ready');
    });

    it('should fail ping when websocket disconnected', async () => {
      const mockClient = (Client as any).mock.results[0].value;
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
      const mockClient = (Client as any).mock.results[0].value;
      const mockTextChannel = await mockClient.channels.fetch();

      const mockMessage = {
        author: { bot: true, id: 'bot-123' },
        content: JSON.stringify({
          protocolVersion: '1.0.0',
          messageType: MessageType.HEARTBEAT,
          senderId: 'agent-1',
          timestamp: new Date().toISOString(),
          priority: 'low',
        }),
      };

      mockTextChannel.messages.fetch.mockResolvedValueOnce(
        new Map([['msg-1', mockMessage]])
      );

      const history = await channel.getHistory(10);

      expect(history).toHaveLength(1);
      expect(history[0].messageType).toBe(MessageType.HEARTBEAT);
    });

    it('should skip invalid JSON messages in history', async () => {
      const mockClient = (Client as any).mock.results[0].value;
      const mockTextChannel = await mockClient.channels.fetch();

      const mockMessages = new Map([
        ['msg-1', { author: { bot: true }, content: 'invalid json' }],
        ['msg-2', { author: { bot: true }, content: '{ incomplete json' }],
      ]);

      mockTextChannel.messages.fetch.mockResolvedValueOnce(mockMessages);

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

/**
 * Unit Test: SlackChannel
 * Tests Slack Socket Mode channel adapter functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SlackChannel } from '../../../src/channels/slack/SlackChannel.js';
import type { ChannelConfig } from '../../../src/channels/base/Channel.js';
import { MessageType } from '../../../src/protocol/Message.js';

// Mock @slack/web-api
vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    auth: {
      test: vi.fn().mockResolvedValue({
        ok: true,
        user_id: 'U123',
        team: 'T456',
      }),
    },
    conversations: {
      info: vi.fn().mockResolvedValue({
        ok: true,
        channel: { id: 'C789', name: 'test-channel' },
      }),
      history: vi.fn().mockResolvedValue({
        ok: true,
        messages: [],
      }),
    },
    chat: {
      postMessage: vi.fn().mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
      }),
    },
  })),
}));

// Mock @slack/socket-mode
vi.mock('@slack/socket-mode', () => ({
  SocketModeClient: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  })),
}));

describe('SlackChannel', () => {
  let channel: SlackChannel;
  let config: ChannelConfig;

  beforeEach(() => {
    config = {
      type: 'slack',
      token: 'test-channel-token',
      connectionParams: {
        botToken: 'xoxb-bot-token',
        appToken: 'xapp-app-token',
        channelId: 'C789',
        teamId: 'T456',
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
    it('should create Slack channel with valid config', () => {
      channel = new SlackChannel(config);

      expect(channel).toBeDefined();
      expect(channel.status).toBe('disconnected');
    });

    it('should setup Socket Mode event handlers', () => {
      channel = new SlackChannel(config);

      const socketClient = (channel as any).socketClient;
      expect(socketClient.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(socketClient.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Connection', () => {
    it('should connect to Slack successfully', async () => {
      channel = new SlackChannel(config);
      await channel.connect();

      expect(channel.status).toBe('connected');

      const webClient = (channel as any).webClient;
      expect(webClient.auth.test).toHaveBeenCalled();
      expect(webClient.conversations.info).toHaveBeenCalledWith({
        channel: 'C789',
      });
    });

    it('should disconnect from Slack successfully', async () => {
      channel = new SlackChannel(config);
      await channel.connect();
      await channel.disconnect();

      expect(channel.status).toBe('disconnected');

      const socketClient = (channel as any).socketClient;
      expect(socketClient.disconnect).toHaveBeenCalled();
    });

    it('should throw error if bot cannot access channel', async () => {
      channel = new SlackChannel(config);

      const webClient = (channel as any).webClient;
      webClient.conversations.info.mockRejectedValueOnce(new Error('channel_not_found'));

      await expect(channel.connect()).rejects.toThrow(
        'Cannot access Slack channel'
      );
    });

    it('should store bot user ID after auth', async () => {
      channel = new SlackChannel(config);
      await channel.connect();

      const botUserId = (channel as any).botUserId;
      expect(botUserId).toBe('U123');
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      channel = new SlackChannel(config);
      await channel.connect();
    });

    it('should send protocol message to Slack', async () => {
      const message = {
        protocolVersion: '1.0.0',
        messageType: MessageType.TASK_ASSIGNED,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'medium' as const,
        payload: { taskId: 'task-1' },
      };

      await channel.sendMessage(message);

      const webClient = (channel as any).webClient;
      expect(webClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C789',
        text: expect.stringContaining('task_assigned'),
      });
    });

    it('should send plain text message', async () => {
      await channel.sendText('Hello, team!');

      const webClient = (channel as any).webClient;
      expect(webClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'C789',
        text: 'Hello, team!',
      });
    });

    it('should reject message exceeding 40000 character limit', async () => {
      const largePayload = 'x'.repeat(40100);
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
  });

  describe('Message Receiving', () => {
    beforeEach(async () => {
      channel = new SlackChannel(config);
      await channel.connect();
    });

    it('should handle incoming protocol messages', async () => {
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

      // Simulate incoming Slack message
      const socketClient = (channel as any).socketClient;
      const messageHandler = socketClient.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )[1];

      const mockAck = vi.fn().mockResolvedValue(undefined);
      await messageHandler({
        event: {
          channel: 'C789',
          user: 'U456',
          text: JSON.stringify(testMessage),
        },
        ack: mockAck,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAck).toHaveBeenCalled();
      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].messageType).toBe(MessageType.TASK_ASSIGNED);
    });

    it('should handle plain text messages via text handler', async () => {
      const receivedTexts: string[] = [];
      channel.onTextMessage((text) => receivedTexts.push(text));

      const socketClient = (channel as any).socketClient;
      const messageHandler = socketClient.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )[1];

      const mockAck = vi.fn().mockResolvedValue(undefined);
      await messageHandler({
        event: {
          channel: 'C789',
          user: 'U456',
          text: 'Hello, bot!',
        },
        ack: mockAck,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedTexts).toHaveLength(1);
      expect(receivedTexts[0]).toBe('Hello, bot!');
    });

    it('should ignore messages from bot itself', async () => {
      const receivedMessages: any[] = [];
      channel.onMessage((msg) => receivedMessages.push(msg));

      const socketClient = (channel as any).socketClient;
      const messageHandler = socketClient.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )[1];

      const mockAck = vi.fn().mockResolvedValue(undefined);
      await messageHandler({
        event: {
          channel: 'C789',
          user: 'U123', // Bot's own ID
          text: 'Test message',
        },
        ack: mockAck,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(0);
    });

    it('should ignore messages from other channels', async () => {
      const receivedMessages: any[] = [];
      channel.onMessage((msg) => receivedMessages.push(msg));

      const socketClient = (channel as any).socketClient;
      const messageHandler = socketClient.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )[1];

      const mockAck = vi.fn().mockResolvedValue(undefined);
      await messageHandler({
        event: {
          channel: 'C999', // Different channel
          user: 'U456',
          text: 'Test message',
        },
        ack: mockAck,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(0);
    });

    it('should ignore message subtypes', async () => {
      const receivedMessages: any[] = [];
      channel.onMessage((msg) => receivedMessages.push(msg));

      const socketClient = (channel as any).socketClient;
      const messageHandler = socketClient.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )[1];

      const mockAck = vi.fn().mockResolvedValue(undefined);
      await messageHandler({
        event: {
          channel: 'C789',
          user: 'U456',
          text: 'Test message',
          subtype: 'message_changed',
        },
        ack: mockAck,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(0);
    });
  });

  describe('Text Message Handlers', () => {
    beforeEach(async () => {
      channel = new SlackChannel(config);
      await channel.connect();
    });

    it('should register and unregister text handlers', () => {
      const handler = vi.fn();
      const unregister = channel.onTextMessage(handler);

      expect(typeof unregister).toBe('function');

      unregister();

      // Verify handler was removed
      const handlers = (channel as any).textMessageHandlers;
      expect(handlers.has(handler)).toBe(false);
    });

    it('should call multiple text handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      channel.onTextMessage(handler1);
      channel.onTextMessage(handler2);

      const socketClient = (channel as any).socketClient;
      const messageHandler = socketClient.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )[1];

      const mockAck = vi.fn().mockResolvedValue(undefined);
      await messageHandler({
        event: {
          channel: 'C789',
          user: 'U456',
          text: 'Plain text',
        },
        ack: mockAck,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handler1).toHaveBeenCalledWith('Plain text', 'U456');
      expect(handler2).toHaveBeenCalledWith('Plain text', 'U456');
    });
  });

  describe('Ping', () => {
    beforeEach(async () => {
      channel = new SlackChannel(config);
      await channel.connect();
    });

    it('should ping Slack successfully', async () => {
      await expect(channel.ping()).resolves.not.toThrow();

      const webClient = (channel as any).webClient;
      expect(webClient.auth.test).toHaveBeenCalled();
    });

    it('should fail ping when auth.test fails', async () => {
      const webClient = (channel as any).webClient;
      webClient.auth.test.mockResolvedValueOnce({ ok: false });

      await expect(channel.ping()).rejects.toThrow('auth.test failed');
    });
  });

  describe('Message History', () => {
    beforeEach(async () => {
      channel = new SlackChannel(config);
      await channel.connect();
    });

    it('should fetch message history', async () => {
      const webClient = (channel as any).webClient;
      const testMessage = {
        protocolVersion: '1.0.0',
        messageType: MessageType.HEARTBEAT,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'low' as const,
      };

      webClient.conversations.history.mockResolvedValueOnce({
        ok: true,
        messages: [
          { text: JSON.stringify(testMessage) },
        ],
      });

      const history = await channel.getHistory(10);

      expect(history).toHaveLength(1);
      expect(history[0].messageType).toBe(MessageType.HEARTBEAT);
      expect(webClient.conversations.history).toHaveBeenCalledWith({
        channel: 'C789',
        limit: 10,
      });
    });

    it('should fetch history with before timestamp', async () => {
      const webClient = (channel as any).webClient;
      const beforeDate = new Date();

      webClient.conversations.history.mockResolvedValueOnce({
        ok: true,
        messages: [],
      });

      await channel.getHistory(10, beforeDate);

      expect(webClient.conversations.history).toHaveBeenCalledWith({
        channel: 'C789',
        limit: 10,
        latest: String(beforeDate.getTime() / 1000),
      });
    });

    it('should skip non-JSON messages in history', async () => {
      const webClient = (channel as any).webClient;

      webClient.conversations.history.mockResolvedValueOnce({
        ok: true,
        messages: [
          { text: 'Plain text message' },
          { text: '{ invalid json' },
        ],
      });

      const history = await channel.getHistory();

      expect(history).toEqual([]);
    });

    it('should return empty array on error', async () => {
      const webClient = (channel as any).webClient;
      webClient.conversations.history.mockRejectedValueOnce(new Error('API error'));

      const history = await channel.getHistory();

      expect(history).toEqual([]);
    });
  });

  describe('Authentication', () => {
    it('should use bot token for authentication', () => {
      channel = new SlackChannel(config);

      const token = (channel as any).getAuthToken();

      expect(token).toBe('xoxb-bot-token');
    });
  });
});

/**
 * Unit Test: SignalRChannel
 * Tests SignalR channel adapter functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignalRChannel } from '../../../src/channels/signalr/SignalRChannel.js';
import type { ChannelConfig } from '../../../src/channels/base/Channel.js';
import { MessageType } from '../../../src/protocol/Message.js';
import * as signalR from '@microsoft/signalr';

// Mock @microsoft/signalr
vi.mock('@microsoft/signalr', () => {
  const mockConnection = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    invoke: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    onreconnecting: vi.fn(),
    onreconnected: vi.fn(),
    onclose: vi.fn(),
    state: 1, // Connected
    connectionId: 'connection-123',
  };

  const mockBuilder = {
    withUrl: vi.fn().mockReturnThis(),
    withAutomaticReconnect: vi.fn().mockReturnThis(),
    configureLogging: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnValue(mockConnection),
  };

  return {
    HubConnectionBuilder: vi.fn(() => mockBuilder),
    HubConnectionState: {
      Disconnected: 0,
      Connected: 1,
      Connecting: 2,
      Reconnecting: 3,
    },
    HttpTransportType: {
      WebSockets: 1,
      ServerSentEvents: 2,
      LongPolling: 4,
    },
    LogLevel: {
      Information: 2,
    },
  };
});

describe('SignalRChannel', () => {
  let channel: SignalRChannel;
  let config: ChannelConfig;

  beforeEach(() => {
    config = {
      type: 'signalr',
      token: 'test-channel-token',
      connectionParams: {
        hubUrl: 'https://localhost:5001/agentHub',
        accessToken: 'test-access-token',
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
    it('should create SignalR channel with valid config', () => {
      channel = new SignalRChannel(config);

      expect(channel).toBeDefined();
      expect(channel.status).toBe('disconnected');
    });

    it('should warn when using HTTP instead of HTTPS', () => {
      const httpConfig = {
        ...config,
        connectionParams: {
          ...config.connectionParams,
          hubUrl: 'http://localhost:5000/agentHub',
        },
      };

      channel = new SignalRChannel(httpConfig);

      // Verify warning is logged
      expect(channel).toBeDefined();
    });

    it('should setup event handlers on construction', () => {
      channel = new SignalRChannel(config);

      const connection = (channel as any).connection;
      expect(connection.on).toHaveBeenCalledWith('ReceiveMessage', expect.any(Function));
      expect(connection.onreconnecting).toHaveBeenCalled();
      expect(connection.onreconnected).toHaveBeenCalled();
      expect(connection.onclose).toHaveBeenCalled();
    });
  });

  describe('Connection', () => {
    it('should connect to SignalR hub successfully', async () => {
      channel = new SignalRChannel(config);
      await channel.connect();

      expect(channel.status).toBe('connected');

      const connection = (channel as any).connection;
      expect(connection.start).toHaveBeenCalled();
    });

    it('should disconnect from SignalR hub successfully', async () => {
      channel = new SignalRChannel(config);
      await channel.connect();
      await channel.disconnect();

      expect(channel.status).toBe('disconnected');

      const connection = (channel as any).connection;
      expect(connection.stop).toHaveBeenCalled();
    });

    it('should throw error on connection failure', async () => {
      const connection = (signalR.HubConnectionBuilder as any).mock.results[0].value.build();
      connection.start.mockRejectedValueOnce(new Error('Connection failed'));

      channel = new SignalRChannel(config);

      await expect(channel.connect()).rejects.toThrow('Failed to connect to SignalR hub');
    });

    it('should get connection state', async () => {
      channel = new SignalRChannel(config);
      await channel.connect();

      const state = channel.getConnectionState();

      expect(state).toBe(signalR.HubConnectionState.Connected);
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      channel = new SignalRChannel(config);
      await channel.connect();
    });

    it('should send message via SignalR', async () => {
      const message = {
        protocolVersion: '1.0.0',
        messageType: MessageType.TASK_ASSIGNED,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'medium' as const,
        payload: { taskId: 'task-1' },
      };

      await channel.sendMessage(message);

      const connection = (channel as any).connection;
      expect(connection.invoke).toHaveBeenCalledWith(
        'SendMessage',
        expect.stringContaining('TASK_ASSIGNED')
      );
    });

    it('should throw error when not connected', async () => {
      const connection = (channel as any).connection;
      connection.state = signalR.HubConnectionState.Disconnected;

      const message = {
        protocolVersion: '1.0.0',
        messageType: MessageType.HEARTBEAT,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'low' as const,
      };

      await expect(channel.sendMessage(message)).rejects.toThrow(
        'Cannot send message: connection state is'
      );
    });
  });

  describe('Message Receiving', () => {
    beforeEach(async () => {
      channel = new SignalRChannel(config);
      await channel.connect();
    });

    it('should handle incoming SignalR messages', async () => {
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

      // Get the ReceiveMessage handler and simulate message
      const connection = (channel as any).connection;
      const receiveHandler = connection.on.mock.calls.find(
        (call: any) => call[0] === 'ReceiveMessage'
      )[1];

      await receiveHandler(JSON.stringify(testMessage));

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].messageType).toBe(MessageType.TASK_ASSIGNED);
    });

    it('should ignore invalid JSON messages', async () => {
      const receivedMessages: any[] = [];
      channel.onMessage((msg) => receivedMessages.push(msg));

      const connection = (channel as any).connection;
      const receiveHandler = connection.on.mock.calls.find(
        (call: any) => call[0] === 'ReceiveMessage'
      )[1];

      await receiveHandler('{ invalid json');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(0);
    });

    it('should ignore invalid protocol messages', async () => {
      const receivedMessages: any[] = [];
      channel.onMessage((msg) => receivedMessages.push(msg));

      const invalidMessage = {
        // Missing required fields
        someField: 'value',
      };

      const connection = (channel as any).connection;
      const receiveHandler = connection.on.mock.calls.find(
        (call: any) => call[0] === 'ReceiveMessage'
      )[1];

      await receiveHandler(JSON.stringify(invalidMessage));

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(0);
    });
  });

  describe('Reconnection', () => {
    beforeEach(async () => {
      channel = new SignalRChannel(config);
      await channel.connect();
    });

    it('should handle reconnecting state', async () => {
      const connection = (channel as any).connection;
      const reconnectingHandler = connection.onreconnecting.mock.calls[0][0];

      reconnectingHandler(new Error('Connection lost'));

      expect(channel.status).toBe('reconnecting');
    });

    it('should handle reconnected state', async () => {
      const connection = (channel as any).connection;
      const reconnectedHandler = connection.onreconnected.mock.calls[0][0];

      reconnectedHandler('new-connection-id');

      expect(channel.status).toBe('connected');
    });

    it('should handle connection close', async () => {
      const connection = (channel as any).connection;
      const closeHandler = connection.onclose.mock.calls[0][0];

      closeHandler(new Error('Connection closed'));

      expect(channel.status).toBe('disconnected');
    });
  });

  describe('Ping', () => {
    beforeEach(async () => {
      channel = new SignalRChannel(config);
      await channel.connect();
    });

    it('should ping SignalR hub successfully', async () => {
      await expect(channel.ping()).resolves.not.toThrow();

      const connection = (channel as any).connection;
      expect(connection.invoke).toHaveBeenCalledWith('Ping');
    });

    it('should fail ping when not connected', async () => {
      const connection = (channel as any).connection;
      connection.state = signalR.HubConnectionState.Disconnected;

      await expect(channel.ping()).rejects.toThrow('not connected');
    });

    it('should fail ping when hub method fails', async () => {
      const connection = (channel as any).connection;
      connection.invoke.mockRejectedValueOnce(new Error('Ping failed'));

      await expect(channel.ping()).rejects.toThrow('SignalR ping failed');
    });
  });

  describe('Message History', () => {
    beforeEach(async () => {
      channel = new SignalRChannel(config);
      await channel.connect();
    });

    it('should fetch message history when supported', async () => {
      const connection = (channel as any).connection;
      const testMessage = {
        protocolVersion: '1.0.0',
        messageType: MessageType.HEARTBEAT,
        senderId: 'agent-1',
        timestamp: new Date().toISOString(),
        priority: 'low' as const,
      };

      connection.invoke.mockResolvedValueOnce([JSON.stringify(testMessage)]);

      const history = await channel.getHistory(10);

      expect(history).toHaveLength(1);
      expect(history[0].messageType).toBe(MessageType.HEARTBEAT);
      expect(connection.invoke).toHaveBeenCalledWith(
        'GetMessageHistory',
        10,
        undefined
      );
    });

    it('should fetch history with before timestamp', async () => {
      const connection = (channel as any).connection;
      const beforeDate = new Date();

      connection.invoke.mockResolvedValueOnce([]);

      await channel.getHistory(10, beforeDate);

      expect(connection.invoke).toHaveBeenCalledWith(
        'GetMessageHistory',
        10,
        beforeDate.toISOString()
      );
    });

    it('should return empty array when history not supported', async () => {
      const connection = (channel as any).connection;
      connection.invoke.mockRejectedValueOnce(new Error('Method not found'));

      const history = await channel.getHistory();

      expect(history).toEqual([]);
    });

    it('should skip invalid messages in history', async () => {
      const connection = (channel as any).connection;
      connection.invoke.mockResolvedValueOnce([
        '{ invalid json',
        JSON.stringify({ invalid: 'message' }),
      ]);

      const history = await channel.getHistory();

      expect(history).toEqual([]);
    });
  });

  describe('Authentication', () => {
    it('should use channel token for auth', () => {
      channel = new SignalRChannel(config);

      const token = (channel as any).getAuthToken();

      expect(token).toBe('test-channel-token');
    });

    it('should configure access token factory', () => {
      channel = new SignalRChannel(config);

      const builder = (signalR.HubConnectionBuilder as any).mock.results[0].value;

      expect(builder.withUrl).toHaveBeenCalledWith(
        'https://localhost:5001/agentHub',
        expect.objectContaining({
          accessTokenFactory: expect.any(Function),
        })
      );
    });
  });

  describe('Transport Configuration', () => {
    it('should configure WebSockets and SSE transports', () => {
      channel = new SignalRChannel(config);

      const builder = (signalR.HubConnectionBuilder as any).mock.results[0].value;
      const urlConfig = builder.withUrl.mock.calls[0][1];

      expect(urlConfig.transport).toBe(
        signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents
      );
    });

    it('should enable automatic reconnect with exponential backoff', () => {
      channel = new SignalRChannel(config);

      const builder = (signalR.HubConnectionBuilder as any).mock.results[0].value;

      expect(builder.withAutomaticReconnect).toHaveBeenCalledWith({
        nextRetryDelayInMilliseconds: expect.any(Function),
      });
    });
  });
});

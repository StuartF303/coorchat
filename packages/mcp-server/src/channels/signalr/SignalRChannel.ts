/**
 * SignalRChannel - SignalR implementation of Channel interface
 * Provides SignalR-based real-time communication for agent coordination
 */

import * as signalR from '@microsoft/signalr';
import { ChannelAdapter } from '../base/ChannelAdapter.js';
import { ConnectionStatus } from '../base/Channel.js';
import type { ChannelConfig } from '../base/Channel.js';
import type { Message } from '../../protocol/Message.js';
import { validator } from '../../protocol/MessageValidator.js';

/**
 * SignalR-specific configuration
 */
export interface SignalRConfig {
  hubUrl: string;
  accessToken: string;
}

/**
 * SignalRChannel implementation
 */
export class SignalRChannel extends ChannelAdapter {
  private connection: signalR.HubConnection;
  private signalRConfig: SignalRConfig;

  constructor(config: ChannelConfig) {
    super(config);

    this.signalRConfig = config.connectionParams as unknown as SignalRConfig;

    // Validate TLS/HTTPS usage for security
    if (!this.signalRConfig.hubUrl.startsWith('https://')) {
      this.logger.warn('SignalR hub URL is not using HTTPS - connection may be insecure', {
        hubUrl: this.signalRConfig.hubUrl,
      });
    }

    // Initialize SignalR connection with authentication and TLS
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(this.signalRConfig.hubUrl, {
        accessTokenFactory: () => this.getAuthToken(),
        // SignalR will use HTTPS automatically if URL starts with https://
        // Additional transport options can be configured here
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Exponential backoff
          return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
        },
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.setupEventHandlers();
  }

  /**
   * Setup SignalR event handlers
   */
  private setupEventHandlers(): void {
    // Handle incoming messages
    this.connection.on('ReceiveMessage', (messageJson: string) => {
      this.handleSignalRMessage(messageJson).catch((error) => {
        this.handleError(
          error instanceof Error ? error : new Error(String(error))
        );
      });
    });

    // Handle reconnecting
    this.connection.onreconnecting((error) => {
      this.logger.warn('SignalR reconnecting', {
        error: error || undefined,
      });
      this.setStatus(ConnectionStatus.RECONNECTING);
    });

    // Handle reconnected
    this.connection.onreconnected((connectionId) => {
      this.logger.info('SignalR reconnected', { connectionId });
      this.setStatus(ConnectionStatus.CONNECTED);
    });

    // Handle close
    this.connection.onclose((error) => {
      this.logger.warn('SignalR connection closed', {
        error: error || undefined,
      });
      this.setStatus(ConnectionStatus.DISCONNECTED);
    });
  }

  /**
   * Handle incoming SignalR message
   */
  private async handleSignalRMessage(messageJson: string): Promise<void> {
    try {
      // Parse message
      const parsedMessage = JSON.parse(messageJson);

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
      this.logger.error('Failed to parse SignalR message', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Connect to SignalR hub
   */
  protected async doConnect(): Promise<void> {
    try {
      await this.connection.start();
      this.logger.info('Connected to SignalR hub', {
        hubUrl: this.signalRConfig.hubUrl,
        connectionId: this.connection.connectionId,
      });
    } catch (error) {
      throw new Error(
        `Failed to connect to SignalR hub: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Disconnect from SignalR hub
   */
  protected async doDisconnect(): Promise<void> {
    await this.connection.stop();
  }

  /**
   * Send message via SignalR
   */
  protected async doSendMessage(message: Message): Promise<void> {
    if (this.connection.state !== signalR.HubConnectionState.Connected) {
      throw new Error(`Cannot send message: connection state is ${this.connection.state}`);
    }

    // Serialize message to JSON
    const messageJson = JSON.stringify(message);

    // Send via SignalR hub method
    await this.connection.invoke('SendMessage', messageJson);
  }

  /**
   * Ping SignalR connection
   */
  protected async doPing(): Promise<void> {
    if (this.connection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('SignalR connection not connected');
    }

    // Send a ping message to the hub
    try {
      await this.connection.invoke('Ping');
    } catch (error) {
      throw new Error(
        `SignalR ping failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get message history (if supported by hub)
   */
  async getHistory(limit: number = 50, before?: Date): Promise<Message[]> {
    try {
      // Request history from hub
      const messagesJson = await this.connection.invoke<string[]>(
        'GetMessageHistory',
        limit,
        before?.toISOString()
      );

      const messages: Message[] = [];
      for (const messageJson of messagesJson) {
        try {
          const parsed = JSON.parse(messageJson);
          const validationResult = validator.validate(parsed);
          if (validationResult.valid) {
            messages.push(parsed as Message);
          }
        } catch {
          // Skip invalid messages
        }
      }

      return messages;
    } catch (error) {
      this.logger.debug('Message history not supported by SignalR hub', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return [];
    }
  }

  /**
   * Get connection state
   */
  getConnectionState(): signalR.HubConnectionState {
    return this.connection.state;
  }

  /**
   * Get authentication token for SignalR
   */
  protected getAuthToken(): string {
    // Use the shared channel token for authentication
    return this.config.token;
  }
}

// Register with factory
import { ChannelFactory } from '../base/ChannelFactory.js';
ChannelFactory.register('signalr', SignalRChannel);

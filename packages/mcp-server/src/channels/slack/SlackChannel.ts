/**
 * SlackChannel - Slack Socket Mode implementation of Channel interface
 * Provides Slack-based communication for agent coordination
 */

import { WebClient } from '@slack/web-api';
import { SocketModeClient } from '@slack/socket-mode';
import { ChannelAdapter } from '../base/ChannelAdapter.js';
import type { ChannelConfig } from '../base/Channel.js';
import type { Message } from '../../protocol/Message.js';
import { validator } from '../../protocol/MessageValidator.js';

/**
 * Handler for plain text (non-protocol) messages
 */
export type TextMessageHandler = (text: string, userId: string) => void | Promise<void>;

/**
 * Slack-specific configuration
 */
export interface SlackConfig {
  botToken: string;
  appToken: string;
  channelId: string;
  teamId?: string;
}

/**
 * SlackChannel implementation
 */
export class SlackChannel extends ChannelAdapter {
  private webClient: WebClient;
  private socketClient: SocketModeClient;
  private slackConfig: SlackConfig;
  private botUserId?: string;
  private textMessageHandlers: Set<TextMessageHandler> = new Set();

  constructor(config: ChannelConfig) {
    super(config);

    this.slackConfig = config.connectionParams as unknown as SlackConfig;

    this.webClient = new WebClient(this.slackConfig.botToken);
    this.socketClient = new SocketModeClient({
      appToken: this.slackConfig.appToken,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Slack Socket Mode event handlers
   */
  private setupEventHandlers(): void {
    // Handle all events_api envelopes (this is how Socket Mode delivers events)
    this.socketClient.on('events_api', async ({ event, body: _body, ack }) => {
      console.log('🔔 Events API envelope received:', {
        eventType: event?.type,
        subtype: event?.subtype,
        channel: event?.channel,
        user: event?.user,
        text: event?.text?.substring(0, 50)
      });

      await ack();

      // Handle message events
      if (event?.type === 'message') {
        this.handleSlackMessage(event).catch((error) => {
          this.handleError(
            error instanceof Error ? error : new Error(String(error))
          );
        });
      }
    });

    // Keep old message handler for backward compatibility
    this.socketClient.on('message', async ({ event, ack }) => {
      console.log('📬 Legacy message event:', {
        type: event?.type,
        channel: event?.channel,
        user: event?.user,
        text: event?.text?.substring(0, 50)
      });
      await ack();
      this.handleSlackMessage(event).catch((error) => {
        this.handleError(
          error instanceof Error ? error : new Error(String(error))
        );
      });
    });

    this.socketClient.on('error', (error) => {
      console.error('❌ Socket error:', error);
      this.handleError(
        error instanceof Error ? error : new Error(String(error))
      );
    });
  }

  /**
   * Handle incoming Slack message
   */
  private async handleSlackMessage(event: any): Promise<void> {
    // Only process messages from our channel
    if (event.channel !== this.slackConfig.channelId) {
      return;
    }

    // Ignore bot's own messages
    if (event.user === this.botUserId) {
      return;
    }

    // Ignore message subtypes (edits, joins, etc.)
    if (event.subtype) {
      return;
    }

    try {
      const content = event.text;
      const parsedMessage = JSON.parse(content);

      const validationResult = validator.validateFull(parsedMessage);
      if (!validationResult.valid) {
        this.logger.warn('Invalid message received', {
          errors: validator.getErrorSummary(validationResult),
        });
        return;
      }

      this.handleMessage(parsedMessage as Message);
    } catch {
      // Not a protocol message — dispatch to text message handlers
      const text = (event.text || '').trim();
      if (text && this.textMessageHandlers.size > 0) {
        this.textMessageHandlers.forEach((handler) => {
          this.safeCall(handler, text, event.user);
        });
      }
    }
  }

  /**
   * Register a handler for plain text (non-protocol) messages
   */
  onTextMessage(handler: TextMessageHandler): () => void {
    this.textMessageHandlers.add(handler);
    return () => this.textMessageHandlers.delete(handler);
  }

  /**
   * Send a plain text message to the Slack channel
   */
  async sendText(text: string): Promise<void> {
    await this.webClient.chat.postMessage({
      channel: this.slackConfig.channelId,
      text,
    });
  }

  /**
   * Get authentication token for Slack connection
   */
  protected getAuthToken(): string {
    return this.slackConfig.botToken;
  }

  /**
   * Connect to Slack
   */
  protected async doConnect(): Promise<void> {
    // Verify bot token by calling auth.test
    const authResult = await this.webClient.auth.test();
    this.botUserId = authResult.user_id;

    this.logger.info('Slack bot authenticated', {
      botUserId: this.botUserId,
      team: authResult.team,
    });

    // Verify channel access
    try {
      await this.webClient.conversations.info({
        channel: this.slackConfig.channelId,
      });
    } catch (error) {
      throw new Error(
        `Cannot access Slack channel ${this.slackConfig.channelId}. ` +
        `Ensure the bot is invited to the channel.`
      );
    }

    // Start socket mode client for real-time events
    await this.socketClient.start();

    this.logger.info('Connected to Slack channel', {
      channelId: this.slackConfig.channelId,
      teamId: this.slackConfig.teamId,
    });
  }

  /**
   * Disconnect from Slack
   */
  protected async doDisconnect(): Promise<void> {
    await this.socketClient.disconnect();
    this.botUserId = undefined;
  }

  /**
   * Send message to Slack
   */
  protected async doSendMessage(message: Message): Promise<void> {
    const content = JSON.stringify(message);

    // Slack has a 40,000 character limit for message text
    if (content.length > 40000) {
      throw new Error(`Message too long: ${content.length} characters (max 40000)`);
    }

    await this.webClient.chat.postMessage({
      channel: this.slackConfig.channelId,
      text: content,
    });
  }

  /**
   * Ping Slack
   */
  protected async doPing(): Promise<void> {
    const result = await this.webClient.auth.test();
    if (!result.ok) {
      throw new Error('Slack auth.test failed');
    }
  }

  /**
   * Get message history from Slack
   */
  async getHistory(limit: number = 50, before?: Date): Promise<Message[]> {
    try {
      const options: any = {
        channel: this.slackConfig.channelId,
        limit,
      };

      if (before) {
        // Slack uses Unix timestamps with microsecond precision
        options.latest = String(before.getTime() / 1000);
      }

      const result = await this.webClient.conversations.history(options);
      const parsedMessages: Message[] = [];

      if (result.messages) {
        for (const slackMessage of result.messages) {
          if (slackMessage.text) {
            try {
              const parsed = JSON.parse(slackMessage.text);
              const validationResult = validator.validate(parsed);
              if (validationResult.valid) {
                parsedMessages.push(parsed as Message);
              }
            } catch {
              // Skip non-JSON messages
            }
          }
        }
      }

      return parsedMessages;
    } catch (error) {
      this.logger.error('Failed to fetch message history', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return [];
    }
  }
}

// Register with factory
import { ChannelFactory } from '../base/ChannelFactory.js';
ChannelFactory.register('slack', SlackChannel);

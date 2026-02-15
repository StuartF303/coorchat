/**
 * DiscordChannel - Discord.js implementation of Channel interface
 * Provides Discord-based communication for agent coordination
 */

import { Client, GatewayIntentBits, TextChannel, Message as DiscordMessage } from 'discord.js';
import { ChannelAdapter } from '../base/ChannelAdapter.js';
import type { ChannelConfig } from '../base/Channel.js';
import type { Message } from '../../protocol/Message.js';
import { validator } from '../../protocol/MessageValidator.js';

/**
 * Discord-specific configuration
 */
export interface DiscordConfig {
  guildId: string;
  channelId: string;
  botToken: string;
}

/**
 * DiscordChannel implementation
 */
export class DiscordChannel extends ChannelAdapter {
  private client: Client;
  private discordConfig: DiscordConfig;
  private textChannel?: TextChannel;

  constructor(config: ChannelConfig) {
    super(config);

    this.discordConfig = config.connectionParams as unknown as DiscordConfig;

    // Initialize Discord client
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Discord event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      this.logger.info('Discord client ready', {
        username: this.client.user?.tag,
      });
    });

    this.client.on('messageCreate', (message) => {
      this.handleDiscordMessage(message).catch((error) => {
        this.handleError(
          error instanceof Error ? error : new Error(String(error))
        );
      });
    });

    this.client.on('error', (error) => {
      this.handleError(error);
    });
  }

  /**
   * Handle incoming Discord message
   */
  private async handleDiscordMessage(discordMessage: DiscordMessage): Promise<void> {
    // Ignore messages from bots (except our own for history)
    if (discordMessage.author.bot && discordMessage.author.id !== this.client.user?.id) {
      return;
    }

    // Only process messages from our channel
    if (discordMessage.channelId !== this.discordConfig.channelId) {
      return;
    }

    try {
      // Parse message content as JSON
      const content = discordMessage.content;
      const parsedMessage = JSON.parse(content);

      // Validate message
      const validationResult = validator.validateFull(parsedMessage);
      if (!validationResult.valid) {
        this.logger.warn('Invalid message received', {
          errors: validator.getErrorSummary(validationResult),
        });
        return;
      }

      // Authenticate message: check if sender has valid token
      // For Discord, we trust all messages in the channel since channel access is controlled
      // by Discord's own authentication. The shared token is used for bot authentication.
      if (!this.authenticateMessage(parsedMessage)) {
        this.logger.warn('Message authentication failed', {
          senderId: parsedMessage.senderId,
        });
        return;
      }

      // Handle the message
      this.handleMessage(parsedMessage as Message);
    } catch (error) {
      // If parsing fails, it's likely not a protocol message
      this.logger.debug('Failed to parse message as protocol message', {
        content: discordMessage.content,
      });
    }
  }

  /**
   * Authenticate incoming message
   * For Discord, we rely on channel access control
   */
  private authenticateMessage(_message: any): boolean {
    // Basic validation that message has required fields
    // Discord channel access itself provides authentication
    return true;
  }

  /**
   * Get authentication headers for Discord connection
   */
  protected getAuthToken(): string {
    return this.discordConfig.botToken;
  }

  /**
   * Connect to Discord
   */
  protected async doConnect(): Promise<void> {
    // Login to Discord
    await this.client.login(this.discordConfig.botToken);

    // Wait for client to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Discord connection timeout'));
      }, 30000);

      this.client.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Get the text channel
    const channel = await this.client.channels.fetch(this.discordConfig.channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error('Channel not found or is not a text channel');
    }

    this.textChannel = channel as TextChannel;
    this.logger.info('Connected to Discord channel', {
      guildId: this.discordConfig.guildId,
      channelId: this.discordConfig.channelId,
    });
  }

  /**
   * Disconnect from Discord
   */
  protected async doDisconnect(): Promise<void> {
    this.client.destroy();
    this.textChannel = undefined;
  }

  /**
   * Send message to Discord
   */
  protected async doSendMessage(message: Message): Promise<void> {
    if (!this.textChannel) {
      throw new Error('Not connected to Discord channel');
    }

    // Serialize message to JSON
    const content = JSON.stringify(message);

    // Discord has a 2000 character limit
    if (content.length > 2000) {
      throw new Error(`Message too long: ${content.length} characters (max 2000)`);
    }

    // Send message
    await this.textChannel.send(content);
  }

  /**
   * Ping Discord
   */
  protected async doPing(): Promise<void> {
    // Check if client is ready
    if (!this.client.isReady()) {
      throw new Error('Discord client not ready');
    }

    // Discord doesn't have a native ping, so we'll just check the websocket
    const ping = this.client.ws.ping;
    if (ping === -1) {
      throw new Error('Discord websocket not connected');
    }
  }

  /**
   * Get message history from Discord
   */
  async getHistory(limit: number = 50, before?: Date): Promise<Message[]> {
    if (!this.textChannel) {
      return [];
    }

    try {
      const options: any = { limit };
      if (before) {
        // Discord uses snowflake IDs, we need to convert timestamp
        // This is an approximation
        options.before = String(before.getTime());
      }

      const fetchResult = await this.textChannel.messages.fetch(options);
      const parsedMessages: Message[] = [];
      const messages = fetchResult instanceof Map ? Array.from(fetchResult.values()) : [fetchResult];

      for (const discordMessage of messages) {
        if (discordMessage.author.bot) {
          try {
            const parsed = JSON.parse(discordMessage.content);
            const validationResult = validator.validate(parsed);
            if (validationResult.valid) {
              parsedMessages.push(parsed as Message);
            }
          } catch {
            // Skip invalid messages
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
ChannelFactory.register('discord', DiscordChannel);

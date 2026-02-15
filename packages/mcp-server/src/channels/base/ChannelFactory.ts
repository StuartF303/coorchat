/**
 * ChannelFactory - Factory pattern for creating channel instances
 *
 * Creates appropriate channel implementation based on configuration
 */

import { Channel, ChannelConfig } from './Channel.js';

/**
 * Channel constructor type
 */
export type ChannelConstructor = new (config: ChannelConfig) => Channel;

/**
 * Factory for creating channel instances
 */
export class ChannelFactory {
  /**
   * Registry of channel constructors by type
   */
  private static registry: Map<string, ChannelConstructor> = new Map();

  /**
   * Register a channel implementation
   * @param type - Channel type identifier
   * @param constructor - Channel class constructor
   */
  static register(type: string, constructor: ChannelConstructor): void {
    if (this.registry.has(type)) {
      throw new Error(`Channel type "${type}" is already registered`);
    }
    this.registry.set(type, constructor);
  }

  /**
   * Unregister a channel implementation
   * @param type - Channel type identifier
   */
  static unregister(type: string): void {
    this.registry.delete(type);
  }

  /**
   * Check if a channel type is registered
   * @param type - Channel type identifier
   */
  static isRegistered(type: string): boolean {
    return this.registry.has(type);
  }

  /**
   * Get all registered channel types
   */
  static getRegisteredTypes(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Create a channel instance
   * @param config - Channel configuration
   * @returns Channel instance
   * @throws Error if channel type is not registered
   */
  static create(config: ChannelConfig): Channel {
    const constructor = this.registry.get(config.type);

    if (!constructor) {
      throw new Error(
        `Unknown channel type: "${config.type}". ` +
          `Available types: ${this.getRegisteredTypes().join(', ')}`
      );
    }

    try {
      return new constructor(config);
    } catch (error) {
      throw new Error(
        `Failed to create channel of type "${config.type}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Create multiple channel instances from an array of configurations
   * @param configs - Array of channel configurations
   * @returns Array of channel instances
   */
  static createMany(configs: ChannelConfig[]): Channel[] {
    return configs.map((config) => this.create(config));
  }

  /**
   * Validate channel configuration
   * @param config - Channel configuration to validate
   * @throws Error if configuration is invalid
   */
  static validateConfig(config: ChannelConfig): void {
    if (!config.type) {
      throw new Error('Channel configuration must include a type');
    }

    if (!config.token) {
      throw new Error('Channel configuration must include an authentication token');
    }

    if (!config.connectionParams || typeof config.connectionParams !== 'object') {
      throw new Error('Channel configuration must include connectionParams object');
    }

    if (!this.isRegistered(config.type)) {
      throw new Error(
        `Channel type "${config.type}" is not registered. ` +
          `Available types: ${this.getRegisteredTypes().join(', ')}`
      );
    }
  }

  /**
   * Create a channel with validation
   * @param config - Channel configuration
   * @returns Channel instance
   * @throws Error if configuration is invalid or creation fails
   */
  static createSafe(config: ChannelConfig): Channel {
    this.validateConfig(config);
    return this.create(config);
  }

  /**
   * Clear all registered channel types (useful for testing)
   */
  static clear(): void {
    this.registry.clear();
  }

  /**
   * Get default retry configuration
   */
  static getDefaultRetryConfig() {
    return {
      enabled: true,
      maxAttempts: 5,
      initialDelayMs: 1000,
      maxDelayMs: 60000,
    };
  }

  /**
   * Get default heartbeat configuration
   */
  static getDefaultHeartbeatConfig() {
    return {
      enabled: true,
      intervalMs: 15000,
      timeoutMs: 30000,
    };
  }

  /**
   * Create a channel configuration with defaults
   * @param type - Channel type
   * @param token - Authentication token
   * @param connectionParams - Connection parameters
   * @param overrides - Optional configuration overrides
   */
  static createConfig(
    type: 'discord' | 'signalr' | 'redis' | 'relay',
    token: string,
    connectionParams: Record<string, unknown>,
    overrides?: Partial<ChannelConfig>
  ): ChannelConfig {
    return {
      type,
      token,
      connectionParams,
      retry: overrides?.retry ?? this.getDefaultRetryConfig(),
      heartbeat: overrides?.heartbeat ?? this.getDefaultHeartbeatConfig(),
      ...overrides,
    };
  }
}

/**
 * Decorator for auto-registering channel implementations
 * Usage: @RegisterChannel('discord')
 */
export function RegisterChannel(type: string) {
  return function <T extends ChannelConstructor>(constructor: T): T {
    ChannelFactory.register(type, constructor);
    return constructor;
  };
}

/**
 * ConfigValidator - Validate configuration using Zod schemas
 * Based on specs/001-multi-agent-coordination/plan.md configuration requirements
 */

import { z } from 'zod';

/**
 * Retry configuration schema
 */
export const RetryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxAttempts: z.number().int().positive().default(5),
  initialDelayMs: z.number().int().positive().default(1000),
  maxDelayMs: z.number().int().positive().default(60000),
});

/**
 * Heartbeat configuration schema
 */
export const HeartbeatConfigSchema = z.object({
  enabled: z.boolean().default(true),
  intervalMs: z.number().int().positive().default(15000),
  timeoutMs: z.number().int().positive().default(30000),
});

/**
 * Discord channel configuration schema
 */
export const DiscordConfigSchema = z.object({
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  botToken: z.string().min(1),
});

/**
 * SignalR channel configuration schema
 */
export const SignalRConfigSchema = z.object({
  hubUrl: z.string().url(),
  accessToken: z.string().min(1),
});

/**
 * Redis channel configuration schema
 */
export const RedisConfigSchema = z.object({
  host: z.string().min(1).default('localhost'),
  port: z.number().int().positive().default(6379),
  password: z.string().optional(),
  db: z.number().int().min(0).default(0),
  keyPrefix: z.string().default('coorchat:'),
  tls: z.boolean().default(false),
});

/**
 * Relay channel configuration schema
 */
export const RelayConfigSchema = z.object({
  serverUrl: z.string().url(),
  accessToken: z.string().min(1),
  channelId: z.string().uuid(),
});

/**
 * Slack channel configuration schema
 */
export const SlackConfigSchema = z.object({
  botToken: z.string().min(1),
  appToken: z.string().min(1),
  channelId: z.string().min(1),
  teamId: z.string().optional(),
});

/**
 * Channel configuration schema (discriminated union)
 */
export const ChannelConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('discord'),
    token: z.string().min(1),
    connectionParams: DiscordConfigSchema,
    retry: RetryConfigSchema.optional(),
    heartbeat: HeartbeatConfigSchema.optional(),
  }),
  z.object({
    type: z.literal('signalr'),
    token: z.string().min(1),
    connectionParams: SignalRConfigSchema,
    retry: RetryConfigSchema.optional(),
    heartbeat: HeartbeatConfigSchema.optional(),
  }),
  z.object({
    type: z.literal('redis'),
    token: z.string().min(1),
    connectionParams: RedisConfigSchema,
    retry: RetryConfigSchema.optional(),
    heartbeat: HeartbeatConfigSchema.optional(),
  }),
  z.object({
    type: z.literal('relay'),
    token: z.string().min(1),
    connectionParams: RelayConfigSchema,
    retry: RetryConfigSchema.optional(),
    heartbeat: HeartbeatConfigSchema.optional(),
  }),
  z.object({
    type: z.literal('slack'),
    token: z.string().min(1),
    connectionParams: SlackConfigSchema,
    retry: RetryConfigSchema.optional(),
    heartbeat: HeartbeatConfigSchema.optional(),
  }),
]);

/**
 * GitHub configuration schema
 */
export const GitHubConfigSchema = z.object({
  token: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
  webhookSecret: z.string().optional(),
  webhookPort: z.number().int().positive().default(3000),
  pollingEnabled: z.boolean().default(true),
  pollingIntervalMs: z.number().int().positive().default(30000),
});

/**
 * Agent configuration schema
 */
export const AgentConfigSchema = z.object({
  role: z.string().min(1).max(50),
  platform: z.enum(['Linux', 'macOS', 'Windows']),
  environment: z.string().min(1).max(100),
  tools: z.array(z.string()).min(1),
  languages: z.array(z.string()).optional(),
  apiAccess: z.array(z.string()).optional(),
  resourceLimits: z
    .object({
      apiQuotaPerHour: z.number().int().nonnegative().optional(),
      maxConcurrentTasks: z.number().int().min(1).max(10).default(1),
      rateLimitPerMinute: z.number().int().nonnegative().optional(),
      memoryLimitMB: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

/**
 * Logging configuration schema
 */
export const LoggingConfigSchema = z.object({
  level: z.enum(['ERROR', 'WARN', 'INFO', 'DEBUG']).default('INFO'),
  format: z.enum(['json', 'text']).default('json'),
  output: z.enum(['console', 'file', 'both']).default('console'),
  filePath: z.string().optional(),
});

/**
 * Main application configuration schema
 */
export const AppConfigSchema = z.object({
  channel: ChannelConfigSchema,
  github: GitHubConfigSchema.optional(),
  agent: AgentConfigSchema,
  logging: LoggingConfigSchema.optional(),
});

/**
 * Type exports
 */
export type RetryConfig = z.output<typeof RetryConfigSchema>;
export type HeartbeatConfig = z.output<typeof HeartbeatConfigSchema>;
export type DiscordConfig = z.output<typeof DiscordConfigSchema>;
export type SignalRConfig = z.output<typeof SignalRConfigSchema>;
export type RedisConfig = z.output<typeof RedisConfigSchema>;
export type RelayConfig = z.output<typeof RelayConfigSchema>;
export type SlackConfig = z.output<typeof SlackConfigSchema>;
export type ChannelConfig = z.output<typeof ChannelConfigSchema>;
export type GitHubConfig = z.output<typeof GitHubConfigSchema>;
export type AgentConfig = z.output<typeof AgentConfigSchema>;
export type LoggingConfig = z.output<typeof LoggingConfigSchema>;
export type AppConfig = z.output<typeof AppConfigSchema>;

/**
 * Validation result
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: z.ZodError;
}

/**
 * ConfigValidator class
 */
export class ConfigValidator {
  /**
   * Validate configuration against a schema
   */
  validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
    const result = schema.safeParse(data);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    return {
      success: false,
      errors: result.error,
    };
  }

  /**
   * Validate and throw on error
   */
  validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
    return schema.parse(data);
  }

  /**
   * Validate application configuration
   */
  validateAppConfig(data: unknown): ValidationResult<AppConfig> {
    return this.validate(AppConfigSchema, data) as ValidationResult<AppConfig>;
  }

  /**
   * Validate channel configuration
   */
  validateChannelConfig(data: unknown): ValidationResult<ChannelConfig> {
    return this.validate(ChannelConfigSchema, data) as ValidationResult<ChannelConfig>;
  }

  /**
   * Validate GitHub configuration
   */
  validateGitHubConfig(data: unknown): ValidationResult<GitHubConfig> {
    return this.validate(GitHubConfigSchema, data) as ValidationResult<GitHubConfig>;
  }

  /**
   * Validate agent configuration
   */
  validateAgentConfig(data: unknown): ValidationResult<AgentConfig> {
    return this.validate(AgentConfigSchema, data) as ValidationResult<AgentConfig>;
  }

  /**
   * Get formatted error messages
   */
  formatErrors(errors: z.ZodError): string[] {
    return errors.errors.map((err) => {
      const path = err.path.join('.');
      return `${path}: ${err.message}`;
    });
  }

  /**
   * Get error summary
   */
  getErrorSummary(errors: z.ZodError): string {
    return this.formatErrors(errors).join('; ');
  }
}

/**
 * Singleton validator instance
 */
export const validator = new ConfigValidator();

/**
 * Convenience function to validate app configuration
 */
export function validateAppConfig(data: unknown): AppConfig {
  return validator.validateOrThrow(AppConfigSchema, data) as AppConfig;
}

/**
 * Convenience function to validate channel configuration
 */
export function validateChannelConfig(data: unknown): ChannelConfig {
  return validator.validateOrThrow(ChannelConfigSchema, data) as ChannelConfig;
}

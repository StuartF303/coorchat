/**
 * Command Interface Type Definitions
 * Core types for the agent command system
 */

import type { SlackChannel } from '../channels/slack/SlackChannel.js';
import type { AgentRegistry } from '../agents/AgentRegistry.js';
import type { TaskManager } from '../tasks/TaskManager.js';
import type { TaskWorker } from '../tasks/TaskWorker.js';

/**
 * Command categories
 */
export enum CommandType {
  DISCOVERY = 'discovery',
  COMMUNICATION = 'communication',
  QUEUE = 'queue',
  CONFIG = 'config',
  MONITORING = 'monitoring',
  SYSTEM = 'system',
}

/**
 * Parsed command ready for execution
 */
export interface Command {
  type: CommandType;
  name: string;
  targetAgentId?: string;
  params: Record<string, unknown>;
  userId: string;
  channelId: string;
  timestamp: string;
  rawText: string;
}

/**
 * Structured response to a command
 */
export interface CommandResponse {
  success: boolean;
  message: string;
  data?: unknown;
  timestamp: string;
  commandId?: string;
  errorCode?: string;
}

/**
 * Command definition with metadata and execution handler
 */
export interface CommandDef {
  minArgs: number;
  maxArgs?: number;
  description: string;
  aliases?: string[];
  examples?: string[];
  execute: (
    tokens: string[],
    userId: string,
    channel: SlackChannel,
    registry?: AgentRegistry,
    taskManager?: TaskManager,
    commandRegistry?: any,  // Avoid circular dependency with CommandRegistry
    worker?: TaskWorker,
  ) => Promise<void>;
}

/**
 * Error codes for command failures
 */
export enum ErrorCode {
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  QUEUE_FULL = 'QUEUE_FULL',
  INVALID_MODEL = 'INVALID_MODEL',
  INVALID_PRIORITY = 'INVALID_PRIORITY',
  INVALID_ROLE = 'INVALID_ROLE',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  AGENT_TIMEOUT = 'AGENT_TIMEOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_SYNTAX = 'INVALID_SYNTAX',
  INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',
  CONFIG_ERROR = 'CONFIG_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

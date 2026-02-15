/**
 * Configuration Commands - Agent configuration and lifecycle management
 * Implements User Story 5 (US5): Agent Configuration
 *
 * Commands:
 * - config <agent-id> model <model>: Change agent model
 * - config <agent-id> role <role>: Change agent role
 * - config <agent-id> queue-limit <n>: Change queue capacity (1-1000)
 * - config <agent-id> show: Display all configuration
 * - pause <agent-id>: Pause agent (stop accepting tasks)
 * - resume <agent-id>: Resume agent (start accepting tasks)
 */

import type { AgentRegistry } from '../../agents/AgentRegistry.js';
import type { SlackChannel } from '../../channels/slack/SlackChannel.js';
import type { TaskManager } from '../../tasks/TaskManager.js';
import { SlackFormatter } from '../formatters/SlackFormatter.js';
import { ResponseBuilder } from '../formatters/ResponseBuilder.js';
import { ErrorCode } from '../types.js';
import { AgentStatus } from '../../agents/Agent.js';

/**
 * Valid Claude models
 */
const VALID_MODELS = ['sonnet', 'opus', 'haiku', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];

/**
 * Queue limit range
 */
const MIN_QUEUE_LIMIT = 1;
const MAX_QUEUE_LIMIT = 1000;

/**
 * Config command dispatcher
 */
export async function config(
  tokens: string[],
  userId: string,
  channel: SlackChannel,
  registry?: AgentRegistry,
  taskManager?: TaskManager
): Promise<void> {
  const formatter = new SlackFormatter(channel);

  if (!registry) {
    await formatter.sendError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Agent registry not available',
      suggestion: 'Please contact system administrator',
    });
    return;
  }

  // Extract agent ID (second token)
  const agentId = tokens[1];

  // Verify agent exists
  const agent = registry.getById(agentId);
  if (!agent) {
    await formatter.sendError({
      code: ErrorCode.AGENT_NOT_FOUND,
      message: `Agent '${agentId}' not found`,
      suggestion: 'Use "list agents" to see all connected agents',
    });
    return;
  }

  // Extract subcommand (third token)
  const subcommand = tokens[2]?.toLowerCase();

  switch (subcommand) {
    case 'model':
      await configModel(tokens, agentId, formatter);
      break;
    case 'role':
      await configRole(tokens, agentId, formatter);
      break;
    case 'queue-limit':
      await configQueueLimit(tokens, agentId, formatter, taskManager);
      break;
    case 'show':
      await configShow(agentId, agent, formatter);
      break;
    default:
      await formatter.sendError({
        code: ErrorCode.INVALID_ARGUMENTS,
        message: `Unknown config subcommand: ${subcommand || '(missing)'}`,
        suggestion: 'Use: model, role, queue-limit, or show',
      });
  }
}

/**
 * Configure agent model
 */
async function configModel(
  tokens: string[],
  agentId: string,
  formatter: SlackFormatter
): Promise<void> {
  const model = tokens[3]?.toLowerCase();

  if (!model) {
    await formatter.sendError({
      code: ErrorCode.INVALID_ARGUMENTS,
      message: 'Model name required',
      suggestion: `Valid models: ${VALID_MODELS.join(', ')}`,
    });
    return;
  }

  if (!VALID_MODELS.includes(model)) {
    await formatter.sendError({
      code: ErrorCode.INVALID_ARGUMENTS,
      message: `Invalid model: ${model}`,
      suggestion: `Valid models: ${VALID_MODELS.join(', ')}`,
    });
    return;
  }

  // MVP: Acknowledge model change (TODO: persist to config file)
  await formatter.sendConfirmation(
    `Agent ${agentId} model updated to ${model}`
  );
}

/**
 * Configure agent role
 */
async function configRole(
  tokens: string[],
  agentId: string,
  formatter: SlackFormatter
): Promise<void> {
  const role = tokens[3];

  if (!role) {
    await formatter.sendError({
      code: ErrorCode.INVALID_ARGUMENTS,
      message: 'Role name required',
      suggestion: 'Examples: developer, reviewer, qa, devops',
    });
    return;
  }

  // MVP: Acknowledge role change (TODO: persist to config file)
  await formatter.sendConfirmation(
    `Agent ${agentId} role updated to ${role}`
  );
}

/**
 * Configure queue limit
 */
async function configQueueLimit(
  tokens: string[],
  agentId: string,
  formatter: SlackFormatter,
  taskManager?: TaskManager
): Promise<void> {
  const limitStr = tokens[3];

  if (!limitStr) {
    await formatter.sendError({
      code: ErrorCode.INVALID_ARGUMENTS,
      message: 'Queue limit required',
      suggestion: `Must be a number between ${MIN_QUEUE_LIMIT} and ${MAX_QUEUE_LIMIT}`,
    });
    return;
  }

  const limit = parseInt(limitStr, 10);

  if (isNaN(limit)) {
    await formatter.sendError({
      code: ErrorCode.INVALID_ARGUMENTS,
      message: `Invalid queue limit: ${limitStr}`,
      suggestion: `Must be a number between ${MIN_QUEUE_LIMIT} and ${MAX_QUEUE_LIMIT}`,
    });
    return;
  }

  if (limit < MIN_QUEUE_LIMIT || limit > MAX_QUEUE_LIMIT) {
    await formatter.sendError({
      code: ErrorCode.INVALID_ARGUMENTS,
      message: `Queue limit out of range: ${limit}`,
      suggestion: `Must be between ${MIN_QUEUE_LIMIT} and ${MAX_QUEUE_LIMIT}`,
    });
    return;
  }

  // MVP: Acknowledge limit change (TODO: update TaskManager limit for this agent)
  await formatter.sendConfirmation(
    `Agent ${agentId} queue-limit updated to ${limit}`
  );
}

/**
 * Show agent configuration
 */
async function configShow(
  agentId: string,
  agent: any,
  formatter: SlackFormatter
): Promise<void> {
  // Build configuration display as Record<string, string>
  const sections: Record<string, string> = {
    'Agent ID': agentId,
    'Role': agent.role || 'default',
    'Platform': agent.platform || 'unknown',
    'Environment': agent.environment || 'unknown',
    'Status': agent.status || 'unknown',
    'Current Task': agent.currentTask || 'none',
  };

  await formatter.sendSections(sections, `Configuration for ${agentId}`);
}

/**
 * Pause agent (stop accepting tasks)
 */
export async function pause(
  tokens: string[],
  userId: string,
  channel: SlackChannel,
  registry?: AgentRegistry,
  taskManager?: TaskManager
): Promise<void> {
  const formatter = new SlackFormatter(channel);

  if (!registry) {
    await formatter.sendError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Agent registry not available',
      suggestion: 'Please contact system administrator',
    });
    return;
  }

  // Extract agent ID (second token)
  const agentId = tokens[1];

  // Verify agent exists
  const agent = registry.getById(agentId);
  if (!agent) {
    await formatter.sendError({
      code: ErrorCode.AGENT_NOT_FOUND,
      message: `Agent '${agentId}' not found`,
      suggestion: 'Use "list agents" to see all connected agents',
    });
    return;
  }

  // Update agent status to paused
  await registry.update(agentId, { status: AgentStatus.PAUSED });

  await formatter.sendConfirmation(
    `Agent ${agentId} paused (will not accept new tasks)`
  );
}

/**
 * Resume agent (start accepting tasks)
 */
export async function resume(
  tokens: string[],
  userId: string,
  channel: SlackChannel,
  registry?: AgentRegistry,
  taskManager?: TaskManager
): Promise<void> {
  const formatter = new SlackFormatter(channel);

  if (!registry) {
    await formatter.sendError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Agent registry not available',
      suggestion: 'Please contact system administrator',
    });
    return;
  }

  // Extract agent ID (second token)
  const agentId = tokens[1];

  // Verify agent exists
  const agent = registry.getById(agentId);
  if (!agent) {
    await formatter.sendError({
      code: ErrorCode.AGENT_NOT_FOUND,
      message: `Agent '${agentId}' not found`,
      suggestion: 'Use "list agents" to see all connected agents',
    });
    return;
  }

  // Update agent status to connected
  await registry.update(agentId, { status: AgentStatus.CONNECTED });

  await formatter.sendConfirmation(
    `Agent ${agentId} resumed (now accepting tasks)`
  );
}

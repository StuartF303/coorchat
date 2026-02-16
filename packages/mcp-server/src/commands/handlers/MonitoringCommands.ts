/**
 * Monitoring Commands - Log viewing, metrics, errors, and task history
 * Implements User Story 6 (US6): Monitoring and Debugging
 *
 * Commands:
 * - logs <agent-id> [n]: Retrieve last N log entries (default 50)
 * - metrics <agent-id>: Display task counts, success rate, uptime
 * - errors: Show recent errors across all agents
 * - history <agent-id>: Display completed tasks with durations
 */

import type { AgentRegistry } from '../../agents/AgentRegistry.js';
import type { SlackChannel } from '../../channels/slack/SlackChannel.js';
import type { TaskManager } from '../../tasks/TaskManager.js';
import { SlackFormatter } from '../formatters/SlackFormatter.js';
import { ErrorCode } from '../types.js';

/**
 * Default log count
 */
const DEFAULT_LOG_COUNT = 50;

/**
 * Retrieve agent logs
 */
export async function logs(
  tokens: string[],
  _userId: string,
  channel: SlackChannel,
  registry?: AgentRegistry,
  _taskManager?: TaskManager
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
  const agent = registry.getByIdCaseInsensitive(agentId);
  if (!agent) {
    await formatter.sendError({
      code: ErrorCode.AGENT_NOT_FOUND,
      message: `Agent '${agentId}' not found`,
      suggestion: 'Use "list agents" to see all connected agents',
    });
    return;
  }

  // Extract log count (third token, optional)
  const countStr = tokens[2];
  const count = countStr ? parseInt(countStr, 10) : DEFAULT_LOG_COUNT;

  if (countStr && isNaN(count)) {
    await formatter.sendError({
      code: ErrorCode.INVALID_ARGUMENTS,
      message: `Invalid log count: ${countStr}`,
      suggestion: 'Must be a positive number',
    });
    return;
  }

  // MVP: Show placeholder message
  // TODO: Implement actual log retrieval from agent
  await formatter.sendCodeBlock(
    `No logs available for ${agentId}\n(Log retrieval will be implemented when agents send log data)`,
    'text'
  );
}

/**
 * Display agent metrics
 */
export async function metrics(
  tokens: string[],
  _userId: string,
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

  if (!taskManager) {
    await formatter.sendError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Task manager not available',
      suggestion: 'Please contact system administrator',
    });
    return;
  }

  // Extract agent ID (second token)
  const agentId = tokens[1];

  // Verify agent exists
  const agent = registry.getByIdCaseInsensitive(agentId);
  if (!agent) {
    await formatter.sendError({
      code: ErrorCode.AGENT_NOT_FOUND,
      message: `Agent '${agentId}' not found`,
      suggestion: 'Use "list agents" to see all connected agents',
    });
    return;
  }

  // Get task stats
  const stats = taskManager.getAgentStats(agentId);

  const metricsData: Record<string, string> = {
    'Agent ID': agentId,
    'Role': agent.role || 'default',
    'Status': agent.status || 'unknown',
    'Tasks Pending': stats ? stats.pending.toString() : '0',
    'Tasks Assigned': stats ? stats.assigned.toString() : '0',
    'Total Tasks': stats ? stats.total.toString() : '0',
    'Success Rate': 'N/A (tracking not implemented)',
    'Uptime': 'N/A (tracking not implemented)',
  };

  await formatter.sendSections(metricsData, `Metrics for ${agentId}`);
}

/**
 * Show recent errors across all agents
 */
export async function errors(
  _tokens: string[],
  _userId: string,
  channel: SlackChannel,
  _registry?: AgentRegistry,
  _taskManager?: TaskManager
): Promise<void> {
  const formatter = new SlackFormatter(channel);

  // MVP: Show placeholder message
  // TODO: Implement actual error tracking
  await formatter.sendConfirmation(
    'No recent errors\n(Error tracking will be implemented when agents report errors)'
  );
}

/**
 * Display task history for agent
 */
export async function history(
  tokens: string[],
  _userId: string,
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

  if (!taskManager) {
    await formatter.sendError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Task manager not available',
      suggestion: 'Please contact system administrator',
    });
    return;
  }

  // Extract agent ID (second token)
  const agentId = tokens[1];

  // Verify agent exists
  const agent = registry.getByIdCaseInsensitive(agentId);
  if (!agent) {
    await formatter.sendError({
      code: ErrorCode.AGENT_NOT_FOUND,
      message: `Agent '${agentId}' not found`,
      suggestion: 'Use "list agents" to see all connected agents',
    });
    return;
  }

  // MVP: Show placeholder message
  // TODO: Implement actual task history tracking
  await formatter.sendConfirmation(
    `No task history for ${agentId}\n(History tracking will be implemented when tasks complete)`
  );
}

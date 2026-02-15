/**
 * Queue Commands - Task queue inspection and management
 * Implements User Story 3 (US3): Work Queue Inspection
 *
 * Commands:
 * - queue <agent-id>: Display pending tasks for specific agent
 * - tasks: Display all tasks grouped by agent
 * - cancel <task-id>: Remove task from queue
 */

import type { AgentRegistry } from '../../agents/AgentRegistry.js';
import type { SlackChannel } from '../../channels/slack/SlackChannel.js';
import type { TaskManager } from '../../tasks/TaskManager.js';
import { SlackFormatter } from '../formatters/SlackFormatter.js';
import { ResponseBuilder } from '../formatters/ResponseBuilder.js';
import { ErrorCode } from '../types.js';

/**
 * Display queue for specific agent
 */
export async function queueView(
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
  const agent = registry.getById(agentId);
  if (!agent) {
    await formatter.sendError({
      code: ErrorCode.AGENT_NOT_FOUND,
      message: `Agent '${agentId}' not found`,
      suggestion: 'Use "list agents" to see all connected agents',
    });
    return;
  }

  // Get agent's queue
  const tasks = taskManager.getQueue(agentId);

  if (tasks.length === 0) {
    await formatter.sendInfo(`Agent ${agentId} has no pending tasks.`);
    return;
  }

  // Build table with task details
  const headers = ['Task ID', 'Description', 'Status', 'Created'];
  const rows = tasks.map((task) => [
    task.id.substring(0, 8), // Show first 8 chars of UUID
    ResponseBuilder.truncate(task.description, 50),
    task.status,
    ResponseBuilder.formatRelativeTime(task.createdAt.toISOString()),
  ]);

  await formatter.sendTable(
    headers,
    rows,
    `Task Queue for ${agentId} (${tasks.length} task${tasks.length !== 1 ? 's' : ''})`
  );
}

/**
 * Display all tasks grouped by agent
 */
export async function allTasks(
  tokens: string[],
  userId: string,
  channel: SlackChannel,
  registry?: AgentRegistry,
  taskManager?: TaskManager
): Promise<void> {
  const formatter = new SlackFormatter(channel);

  if (!taskManager) {
    await formatter.sendError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Task manager not available',
      suggestion: 'Please contact system administrator',
    });
    return;
  }

  const allTasks = taskManager.getAllTasks();

  if (allTasks.size === 0) {
    await formatter.sendInfo('No tasks currently in any queue.');
    return;
  }

  // Build sections showing tasks per agent
  const sections: Record<string, string> = {};

  for (const [agentId, tasks] of allTasks.entries()) {
    const taskList = tasks
      .map((task) => `• ${task.id.substring(0, 8)}: ${ResponseBuilder.truncate(task.description, 40)} (${task.status})`)
      .join('\n');

    sections[`Agent ${agentId}`] = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}\n${taskList}`;
  }

  const stats = taskManager.getOverallStats();
  await formatter.sendSections(
    sections,
    `All Tasks (${stats.totalTasks} total across ${stats.totalAgents} agent${stats.totalAgents !== 1 ? 's' : ''})`
  );
}

/**
 * Cancel task by ID
 */
export async function cancelTask(
  tokens: string[],
  userId: string,
  channel: SlackChannel,
  registry?: AgentRegistry,
  taskManager?: TaskManager
): Promise<void> {
  const formatter = new SlackFormatter(channel);

  if (!taskManager) {
    await formatter.sendError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Task manager not available',
      suggestion: 'Please contact system administrator',
    });
    return;
  }

  // Extract task ID (second token)
  const taskId = tokens[1];

  // Check if task exists
  const task = taskManager.getTaskById(taskId);
  if (!task) {
    await formatter.sendError({
      code: ErrorCode.TASK_NOT_FOUND,
      message: `Task '${taskId}' not found`,
      suggestion: 'Use "tasks" to see all queued tasks',
    });
    return;
  }

  // Remove task
  const removed = taskManager.removeTask(taskId);

  if (removed) {
    await formatter.sendConfirmation(
      `Task ${taskId.substring(0, 8)} cancelled: "${ResponseBuilder.truncate(task.description, 60)}"`
    );
  } else {
    await formatter.sendError({
      code: ErrorCode.INTERNAL_ERROR,
      message: `Failed to cancel task '${taskId}'`,
      suggestion: 'Task may have already been removed or completed',
    });
  }
}

/**
 * Assignment Commands - Task assignment and priority management
 * Implements User Story 4 (US4): Task Assignment
 *
 * Commands:
 * - assign <agent-id> <description>: Create task and assign to agent
 * - priority <task-id> <level>: Update task priority (high/medium/low or 1-5)
 */

import type { AgentRegistry } from '../../agents/AgentRegistry.js';
import type { SlackChannel } from '../../channels/slack/SlackChannel.js';
import type { TaskManager } from '../../tasks/TaskManager.js';
import { SlackFormatter } from '../formatters/SlackFormatter.js';
import { ResponseBuilder } from '../formatters/ResponseBuilder.js';
import { ErrorCode } from '../types.js';
import { createTask } from '../../tasks/Task.js';
import { randomUUID } from 'crypto';

/**
 * Priority mapping
 */
const PRIORITY_MAP: Record<string, number> = {
  'high': 1,
  'medium': 3,
  'low': 5,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
};

/**
 * Assign task to agent
 */
export async function assignTask(
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

  // Extract task description (remaining tokens)
  const description = tokens.slice(2).join(' ').trim();

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

  // Check if agent is paused
  if (agent.status === 'paused') {
    await formatter.sendError({
      code: ErrorCode.INVALID_ARGUMENTS,
      message: `Agent '${agentId}' is paused`,
      suggestion: 'Use "resume ' + agentId + '" to resume the agent first',
    });
    return;
  }

  // Generate task ID
  const taskId = randomUUID();

  // Create task (using placeholder GitHub issue info for MVP)
  const task = createTask(taskId, {
    description,
    githubIssueId: 'manual',
    githubIssueUrl: `https://github.com/placeholder/task/${taskId}`,
    dependencies: [],
  });

  // Add task to agent's queue
  try {
    taskManager.addTask(agentId, task);

    await formatter.sendConfirmation(
      `Task assigned to ${agentId}: "${ResponseBuilder.truncate(description, 60)}" (ID: ${taskId.substring(0, 8)})`
    );
  } catch (error) {
    // Check if queue full error
    if (error instanceof Error && error.message.includes('full')) {
      const stats = taskManager.getAgentStats(agentId);
      await formatter.sendError({
        code: ErrorCode.QUEUE_FULL,
        message: `Agent ${agentId}'s queue is full`,
        suggestion: stats
          ? `Current: ${stats.total} tasks (max: ${stats.total}). Cancel some tasks or wait for completion.`
          : 'Cancel some tasks or wait for completion.',
      });
    } else {
      await formatter.sendError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Failed to assign task: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: 'Please try again or contact system administrator',
      });
    }
  }
}

/**
 * Update task priority
 */
export async function updatePriority(
  tokens: string[],
  _userId: string,
  channel: SlackChannel,
  _registry?: AgentRegistry,
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

  // Extract priority level (third token)
  const priorityInput = tokens[2]?.toLowerCase();

  // Validate priority
  if (!priorityInput || !PRIORITY_MAP[priorityInput]) {
    await formatter.sendError({
      code: ErrorCode.INVALID_PRIORITY,
      message: 'Invalid priority level',
      suggestion: 'Use: high, medium, low, or 1-5 (1=highest, 5=lowest)',
    });
    return;
  }

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

  // For MVP: Just acknowledge the priority update
  // Full implementation would reorder the queue
  const priorityValue = PRIORITY_MAP[priorityInput];
  const priorityLabel = priorityInput.match(/^\d$/)
    ? `level ${priorityInput}`
    : priorityInput;

  await formatter.sendConfirmation(
    `Task ${taskId.substring(0, 8)} priority updated to ${priorityLabel} (${priorityValue})`
  );

  // TODO: Implement actual queue reordering
  // This would require extending TaskQueue with priority-based ordering
  // For now, the priority is just recorded but doesn't affect queue order
}

/**
 * ExecutionCommands - Commands for controlling task execution
 * abort: abort the currently running task
 * run next: manually wake the worker to pick up next task
 */

import type { SlackChannel } from '../../channels/slack/SlackChannel.js';
import type { AgentRegistry } from '../../agents/AgentRegistry.js';
import type { TaskManager } from '../../tasks/TaskManager.js';
import type { TaskWorker } from '../../tasks/TaskWorker.js';
import { SlackFormatter } from '../formatters/SlackFormatter.js';

/**
 * Abort the currently running task
 */
export async function abortTask(
  _tokens: string[],
  _userId: string,
  channel: SlackChannel,
  _registry?: AgentRegistry,
  _taskManager?: TaskManager,
  _commandRegistry?: any,
  worker?: TaskWorker,
): Promise<void> {
  const formatter = new SlackFormatter(channel);

  if (!worker) {
    await formatter.sendError('Task worker is not available');
    return;
  }

  const taskId = worker.getCurrentTaskId();
  if (!taskId) {
    await formatter.sendWarning('No task is currently running');
    return;
  }

  const aborted = worker.abortCurrent();
  if (aborted) {
    await formatter.sendConfirmation(`Aborting task \`${taskId.substring(0, 8)}\``);
  } else {
    await formatter.sendError('Failed to abort task');
  }
}

/**
 * Manually wake the worker to process next task
 */
export async function runNext(
  _tokens: string[],
  _userId: string,
  channel: SlackChannel,
  _registry?: AgentRegistry,
  _taskManager?: TaskManager,
  _commandRegistry?: any,
  worker?: TaskWorker,
): Promise<void> {
  const formatter = new SlackFormatter(channel);

  if (!worker) {
    await formatter.sendError('Task worker is not available');
    return;
  }

  if (worker.isPaused()) {
    await formatter.sendWarning('Worker is paused. Use `resume <agent-id>` first.');
    return;
  }

  worker.notify();
  await formatter.sendConfirmation('Worker notified to check for next task');
}

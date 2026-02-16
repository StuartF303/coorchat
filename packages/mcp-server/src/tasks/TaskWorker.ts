/**
 * TaskWorker - Sequential queue processor
 * Picks tasks one at a time, executes via TaskExecutor, reports to Slack
 */

import type { TaskExecutor, ExecutionResult } from './TaskExecutor.js';
import type { TaskManager } from './TaskManager.js';
import type { SlackChannel } from '../channels/slack/SlackChannel.js';
import type { AgentRegistry } from '../agents/AgentRegistry.js';
import { AgentStatus } from '../agents/Agent.js';
import { startTask, type Task } from './Task.js';

/**
 * TaskWorker configuration
 */
export interface TaskWorkerConfig {
  /** Agent ID this worker processes tasks for */
  agentId: string;

  /** TaskManager for queue access */
  taskManager: TaskManager;

  /** TaskExecutor for running tasks */
  executor: TaskExecutor;

  /** Slack channel for reporting */
  channel: SlackChannel;

  /** Agent registry for status integration */
  agentRegistry: AgentRegistry;

  /** Minimum interval between progress messages (ms) */
  progressDebounceMs?: number;
}

/**
 * TaskWorker class
 */
export class TaskWorker {
  private agentId: string;
  private taskManager: TaskManager;
  private executor: TaskExecutor;
  private channel: SlackChannel;
  private agentRegistry: AgentRegistry;
  private progressDebounceMs: number;

  private running = false;
  private paused = false;
  private currentTaskId: string | null = null;

  // Signal mechanism: resolve this to wake the loop
  private wakeResolve: (() => void) | null = null;

  // Unsubscribe from agent registry events
  private unsubscribeAgentEvents: (() => void) | null = null;

  constructor(config: TaskWorkerConfig) {
    this.agentId = config.agentId;
    this.taskManager = config.taskManager;
    this.executor = config.executor;
    this.channel = config.channel;
    this.agentRegistry = config.agentRegistry;
    this.progressDebounceMs = config.progressDebounceMs
      || parseInt(process.env.PROGRESS_DEBOUNCE_MS || '10000', 10);
  }

  /**
   * Start the worker loop
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;

    // Listen for agent status changes (pause/resume commands)
    this.unsubscribeAgentEvents = this.agentRegistry.onEvent((event) => {
      if (event.agent.id.toLowerCase() !== this.agentId.toLowerCase()) return;

      if (event.type === 'agent_updated') {
        if (event.agent.status === AgentStatus.PAUSED) {
          this.pause();
        } else if (event.agent.status === AgentStatus.CONNECTED && this.paused) {
          this.resume();
        }
      }
    });

    // Fire and forget the loop
    this.loop().catch((err) => {
      console.error('TaskWorker loop crashed:', err);
    });

    console.log(`TaskWorker started for agent ${this.agentId}`);
  }

  /**
   * Stop the worker, abort any running task
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    this.executor.abort();
    this.wake();

    if (this.unsubscribeAgentEvents) {
      this.unsubscribeAgentEvents();
      this.unsubscribeAgentEvents = null;
    }

    console.log(`TaskWorker stopped for agent ${this.agentId}`);
  }

  /**
   * Wake the idle worker to check for new tasks
   */
  notify(): void {
    this.wake();
  }

  /**
   * Pause processing (agent paused)
   */
  pause(): void {
    this.paused = true;
    console.log(`TaskWorker paused for agent ${this.agentId}`);
  }

  /**
   * Resume processing (agent resumed)
   */
  resume(): void {
    this.paused = false;
    this.wake();
    console.log(`TaskWorker resumed for agent ${this.agentId}`);
  }

  /**
   * Abort the currently running task
   */
  abortCurrent(): boolean {
    return this.executor.abort();
  }

  /**
   * Get the ID of the currently executing task
   */
  getCurrentTaskId(): string | null {
    return this.currentTaskId;
  }

  /**
   * Whether the worker is paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Whether the worker is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Main worker loop
   */
  private async loop(): Promise<void> {
    while (this.running) {
      // If paused, wait for signal
      if (this.paused) {
        await this.waitForSignal();
        continue;
      }

      // Try to pick next task
      const task = this.pickNextTask();

      if (!task) {
        // No tasks available, wait for signal
        await this.waitForSignal();
        continue;
      }

      // Execute the task
      await this.executeTask(task);
    }
  }

  /**
   * Pick the next task from the queue
   */
  private pickNextTask(): Task | null {
    const queue = this.taskManager.getTaskQueue(this.agentId);
    if (!queue) return null;

    // Get the agent object for assignNext
    const agent = this.agentRegistry.getByIdCaseInsensitive(this.agentId);
    if (!agent) return null;

    // Use dequeue directly - simpler than assignNext which requires
    // agent availability checks that don't apply to the worker loop
    const task = queue.dequeue();
    if (!task) return null;

    // Move to assigned tracking manually
    // The task is already dequeued, we track it via currentTaskId
    return task;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: Task): Promise<void> {
    this.currentTaskId = task.id;
    const startedTask = startTask(task);

    // Update agent's current task in registry
    await this.agentRegistry.update(this.agentId, { currentTask: task.id });

    // Announce start
    const truncatedDesc = task.description.length > 100
      ? task.description.substring(0, 100) + '...'
      : task.description;
    await this.sendSafe(`Started task \`${task.id.substring(0, 8)}\`: ${truncatedDesc}`);

    // Set up debounced progress reporting
    let lastProgressTime = 0;
    const onProgress = (chunk: string) => {
      const now = Date.now();
      if (now - lastProgressTime >= this.progressDebounceMs) {
        lastProgressTime = now;
        const preview = chunk.length > 300 ? '...' + chunk.slice(-300) : chunk;
        this.sendSafe(`\`${task.id.substring(0, 8)}\` progress:\n\`\`\`\n${preview}\n\`\`\``).catch(() => {});
      }
    };

    // Execute
    let result: ExecutionResult;
    try {
      result = await this.executor.execute(startedTask.description, onProgress);
    } catch (err) {
      result = {
        exitCode: 1,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        timedOut: false,
        durationMs: 0,
      };
    }

    // Clear agent's current task
    this.currentTaskId = null;
    await this.agentRegistry.update(this.agentId, { currentTask: null });

    // Report result
    if (this.executor.wasAborted()) {
      await this.reportAborted(task, result);
    } else if (result.timedOut) {
      await this.reportTimedOut(task, result);
    } else if (result.exitCode === 0) {
      await this.reportCompleted(task, result);
    } else {
      await this.reportFailed(task, result);
    }
  }

  /**
   * Report successful completion
   */
  private async reportCompleted(task: Task, result: ExecutionResult): Promise<void> {
    const durationSec = (result.durationMs / 1000).toFixed(1);
    const output = this.truncateOutput(result.stdout);
    await this.sendSafe(
      `Completed task \`${task.id.substring(0, 8)}\` in ${durationSec}s\n` +
      `\`\`\`\n${output}\n\`\`\``
    );
  }

  /**
   * Report task failure
   */
  private async reportFailed(task: Task, result: ExecutionResult): Promise<void> {
    const durationSec = (result.durationMs / 1000).toFixed(1);
    const errorOutput = this.truncateOutput(result.stderr || result.stdout);
    await this.sendSafe(
      `Failed task \`${task.id.substring(0, 8)}\` (exit ${result.exitCode}, ${durationSec}s)\n` +
      `\`\`\`\n${errorOutput}\n\`\`\``
    );
  }

  /**
   * Report task timeout
   */
  private async reportTimedOut(task: Task, result: ExecutionResult): Promise<void> {
    const durationSec = (result.durationMs / 1000).toFixed(1);
    await this.sendSafe(
      `Timed out task \`${task.id.substring(0, 8)}\` after ${durationSec}s`
    );
  }

  /**
   * Report task abortion
   */
  private async reportAborted(task: Task, _result: ExecutionResult): Promise<void> {
    await this.sendSafe(`Aborted task \`${task.id.substring(0, 8)}\``);
  }

  /**
   * Truncate output for Slack (last ~500 chars)
   */
  private truncateOutput(text: string): string {
    const maxLen = 500;
    if (text.length <= maxLen) return text.trim();
    return '...' + text.slice(-maxLen).trim();
  }

  /**
   * Send text to Slack, swallowing errors
   */
  private async sendSafe(text: string): Promise<void> {
    try {
      await this.channel.sendText(text);
    } catch (err) {
      console.error('TaskWorker: failed to send to Slack:', err);
    }
  }

  /**
   * Wait for a wake signal or timeout
   */
  private waitForSignal(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.wakeResolve = resolve;
      // Also wake periodically to check for new tasks (30s poll fallback)
      setTimeout(() => {
        this.wake();
      }, 30000);
    });
  }

  /**
   * Wake the worker loop
   */
  private wake(): void {
    if (this.wakeResolve) {
      const resolve = this.wakeResolve;
      this.wakeResolve = null;
      resolve();
    }
  }
}

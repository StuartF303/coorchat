/**
 * TaskQueue - FIFO queue with task assignment logic
 * Manages available tasks and assigns them to agents based on capabilities
 */

import type { Task, TaskStatus } from './Task.js';
import { isTaskAvailable, assignTask, TaskStatus as TaskStatusEnum } from './Task.js';
import type { Agent } from '../agents/Agent.js';
import { isAgentAvailable } from '../agents/Agent.js';
import type { Logger } from '../logging/Logger.js';
import { createLogger } from '../logging/Logger.js';

/**
 * Task assignment event
 */
export interface TaskAssignmentEvent {
  task: Task;
  agent: Agent;
  timestamp: Date;
}

/**
 * Task assignment handler
 */
export type TaskAssignmentHandler = (event: TaskAssignmentEvent) => void | Promise<void>;

/**
 * Task lifecycle event types
 */
export type TaskLifecycleEventType =
  | 'task_assigned'
  | 'task_started'
  | 'task_blocked'
  | 'task_progress'
  | 'task_completed'
  | 'task_failed';

/**
 * Task lifecycle event
 */
export interface TaskLifecycleEvent {
  type: TaskLifecycleEventType;
  task: Task;
  agent?: Agent;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Task lifecycle handler
 */
export type TaskLifecycleHandler = (event: TaskLifecycleEvent) => void | Promise<void>;

/**
 * Task queue configuration
 */
export interface TaskQueueConfig {
  /** Logger */
  logger?: Logger;

  /** Maximum queue size */
  maxQueueSize?: number;
}

/**
 * TaskQueue class
 */
export class TaskQueue {
  private queue: Task[];
  private assignedTasks: Map<string, Task>; // taskId → Task
  private logger: Logger;
  private maxQueueSize: number;
  private assignmentHandlers: Set<TaskAssignmentHandler>;
  private lifecycleHandlers: Set<TaskLifecycleHandler>;

  constructor(config: TaskQueueConfig = {}) {
    this.queue = [];
    this.assignedTasks = new Map();
    this.logger = config.logger || createLogger();
    this.maxQueueSize = config.maxQueueSize || 1000;
    this.assignmentHandlers = new Set();
    this.lifecycleHandlers = new Set();
  }

  /**
   * Add task to queue
   */
  enqueue(task: Task, allTasks?: Map<string, Task>): void {
    // Check if task is already in queue or assigned
    if (this.isTaskInQueue(task.id) || this.assignedTasks.has(task.id)) {
      this.logger.warn('Task already in queue or assigned', { taskId: task.id });
      return;
    }

    // Check queue size limit
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(`Queue is full (max: ${this.maxQueueSize})`);
    }

    // Check if task is available
    if (!isTaskAvailable(task, allTasks)) {
      this.logger.warn('Task is not available for assignment', {
        taskId: task.id,
        status: task.status,
      });
      return;
    }

    this.queue.push(task);
    this.logger.info('Task added to queue', {
      taskId: task.id,
      queueSize: this.queue.length,
    });
  }

  /**
   * Remove task from queue (FIFO)
   */
  dequeue(): Task | undefined {
    const task = this.queue.shift();
    if (task) {
      this.logger.debug('Task dequeued', {
        taskId: task.id,
        queueSize: this.queue.length,
      });
    }
    return task;
  }

  /**
   * Peek at next task without removing
   */
  peek(): Task | undefined {
    return this.queue[0];
  }

  /**
   * Assign next available task to an agent
   */
  async assignNext(agent: Agent, allTasks?: Map<string, Task>): Promise<Task | null> {
    // Check if agent is available
    if (!isAgentAvailable(agent)) {
      this.logger.warn('Agent is not available', {
        agentId: agent.id,
        status: agent.status,
        currentTask: agent.currentTask,
      });
      return null;
    }

    // Find first task that matches agent capabilities
    const taskIndex = this.queue.findIndex((task) => {
      return (
        isTaskAvailable(task, allTasks) &&
        this.isTaskSuitableForAgent(task, agent)
      );
    });

    if (taskIndex === -1) {
      this.logger.debug('No suitable tasks available for agent', {
        agentId: agent.id,
        queueSize: this.queue.length,
      });
      return null;
    }

    // Remove task from queue
    const [task] = this.queue.splice(taskIndex, 1);

    // Assign task to agent
    const assignedTask = assignTask(task, agent.id);

    // Store in assigned tasks
    this.assignedTasks.set(assignedTask.id, assignedTask);

    // Notify handlers
    await this.notifyAssignmentHandlers({
      task: assignedTask,
      agent,
      timestamp: new Date(),
    });

    this.logger.info('Task assigned to agent', {
      taskId: assignedTask.id,
      agentId: agent.id,
      queueSize: this.queue.length,
    });

    return assignedTask;
  }

  /**
   * Check if task is suitable for agent (based on capabilities)
   */
  private isTaskSuitableForAgent(task: Task, agent: Agent): boolean {
    // Basic suitability check
    // Can be extended with more sophisticated matching logic

    // For now, all tasks are suitable for all agents
    // In the future, could match task requirements with agent capabilities
    return true;
  }

  /**
   * Mark task as completed (remove from assigned)
   */
  complete(taskId: string): void {
    if (this.assignedTasks.has(taskId)) {
      this.assignedTasks.delete(taskId);
      this.logger.info('Task marked as completed', { taskId });
    }
  }

  /**
   * Return task to queue (unassign)
   */
  unassign(taskId: string): void {
    const task = this.assignedTasks.get(taskId);
    if (task) {
      this.assignedTasks.delete(taskId);

      // Reset task assignment
      const unassignedTask: Task = {
        ...task,
        assignedAgents: [],
        status: TaskStatusEnum.AVAILABLE,
        assignedAt: null,
      };

      this.queue.unshift(unassignedTask); // Add to front of queue
      this.logger.info('Task returned to queue', {
        taskId,
        queueSize: this.queue.length,
      });
    }
  }

  /**
   * Check if task is in queue
   */
  isTaskInQueue(taskId: string): boolean {
    return this.queue.some((task) => task.id === taskId);
  }

  /**
   * Get task from queue by ID
   */
  getTaskById(taskId: string): Task | undefined {
    return (
      this.queue.find((task) => task.id === taskId) ||
      this.assignedTasks.get(taskId)
    );
  }

  /**
   * Get all tasks in queue
   */
  getAllTasks(): Task[] {
    return [...this.queue];
  }

  /**
   * Get all assigned tasks
   */
  getAssignedTasks(): Task[] {
    return Array.from(this.assignedTasks.values());
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get assigned tasks count
   */
  assignedCount(): number {
    return this.assignedTasks.size;
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue = [];
    this.assignedTasks.clear();
    this.logger.info('Queue cleared');
  }

  /**
   * Remove specific task from queue
   */
  remove(taskId: string): boolean {
    const index = this.queue.findIndex((task) => task.id === taskId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.logger.info('Task removed from queue', {
        taskId,
        queueSize: this.queue.length,
      });
      return true;
    }
    return false;
  }

  /**
   * Register assignment handler
   */
  onAssignment(handler: TaskAssignmentHandler): () => void {
    this.assignmentHandlers.add(handler);
    return () => this.assignmentHandlers.delete(handler);
  }

  /**
   * Notify assignment handlers
   */
  private async notifyAssignmentHandlers(event: TaskAssignmentEvent): Promise<void> {
    const promises = Array.from(this.assignmentHandlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error('Error in assignment handler', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    });

    await Promise.all(promises);
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueSize: number;
    assignedCount: number;
    totalProcessed: number;
  } {
    return {
      queueSize: this.queue.length,
      assignedCount: this.assignedTasks.size,
      totalProcessed: this.assignedTasks.size, // Simplified; could track separately
    };
  }

  /**
   * Register lifecycle event handler
   */
  onLifecycle(handler: TaskLifecycleHandler): () => void {
    this.lifecycleHandlers.add(handler);
    return () => this.lifecycleHandlers.delete(handler);
  }

  /**
   * Emit task lifecycle event
   */
  async emitLifecycleEvent(
    type: TaskLifecycleEventType,
    task: Task,
    agent?: Agent,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const event: TaskLifecycleEvent = {
      type,
      task,
      agent,
      metadata,
      timestamp: new Date(),
    };

    await this.notifyLifecycleHandlers(event);
  }

  /**
   * Notify lifecycle handlers
   */
  private async notifyLifecycleHandlers(event: TaskLifecycleEvent): Promise<void> {
    const promises = Array.from(this.lifecycleHandlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error('Error in lifecycle handler', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    });

    await Promise.all(promises);
  }

  /**
   * Mark task as started
   */
  async markStarted(taskId: string, agent: Agent): Promise<void> {
    const task = this.assignedTasks.get(taskId);
    if (task) {
      await this.emitLifecycleEvent('task_started', task, agent);
      this.logger.info('Task started', { taskId, agentId: agent.id });
    }
  }

  /**
   * Mark task as blocked
   */
  async markBlocked(
    taskId: string,
    agent: Agent,
    reason: string,
    blockedBy: string[]
  ): Promise<void> {
    const task = this.assignedTasks.get(taskId);
    if (task) {
      await this.emitLifecycleEvent('task_blocked', task, agent, { reason, blockedBy });
      this.logger.info('Task blocked', { taskId, agentId: agent.id, reason });
    }
  }

  /**
   * Update task progress
   */
  async updateProgress(
    taskId: string,
    agent: Agent,
    percentComplete: number,
    status: string
  ): Promise<void> {
    const task = this.assignedTasks.get(taskId);
    if (task) {
      await this.emitLifecycleEvent('task_progress', task, agent, {
        percentComplete,
        status,
      });
      this.logger.debug('Task progress updated', {
        taskId,
        agentId: agent.id,
        percentComplete,
      });
    }
  }

  /**
   * Mark task as completed
   */
  async markCompleted(
    taskId: string,
    agent: Agent,
    result?: Record<string, unknown>
  ): Promise<void> {
    const task = this.assignedTasks.get(taskId);
    if (task) {
      await this.emitLifecycleEvent('task_completed', task, agent, { result });
      this.complete(taskId); // Remove from assigned
      this.logger.info('Task completed', { taskId, agentId: agent.id });
    }
  }

  /**
   * Mark task as failed
   */
  async markFailed(
    taskId: string,
    agent: Agent,
    error: string,
    retryable: boolean
  ): Promise<void> {
    const task = this.assignedTasks.get(taskId);
    if (task) {
      await this.emitLifecycleEvent('task_failed', task, agent, { error, retryable });

      if (retryable) {
        // Return task to queue for retry
        this.unassign(taskId);
      } else {
        // Remove from assigned
        this.complete(taskId);
      }

      this.logger.warn('Task failed', { taskId, agentId: agent.id, error, retryable });
    }
  }
}

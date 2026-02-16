/**
 * TaskManager - Manages task queues for multiple agents
 * Provides centralized task queue management with per-agent views
 */

import { TaskQueue } from './TaskQueue.js';
import type { Task } from './Task.js';
import type { Logger } from '../logging/Logger.js';
import { createLogger } from '../logging/Logger.js';

/**
 * TaskManager configuration
 */
export interface TaskManagerConfig {
  /** Logger */
  logger?: Logger;

  /** Maximum queue size per agent */
  maxQueueSizePerAgent?: number;
}

/**
 * TaskManager class
 */
export class TaskManager {
  private agentQueues: Map<string, TaskQueue>; // agentId → TaskQueue
  private allTasks: Map<string, Task>; // taskId → Task
  private logger: Logger;
  private maxQueueSizePerAgent: number;
  private taskAddedCallbacks: Set<(agentId: string, task: Task) => void>;

  constructor(config: TaskManagerConfig = {}) {
    this.agentQueues = new Map();
    this.allTasks = new Map();
    this.logger = config.logger || createLogger();
    this.maxQueueSizePerAgent = config.maxQueueSizePerAgent || 50;
    this.taskAddedCallbacks = new Set();
  }

  /**
   * Get or create queue for agent
   */
  private getOrCreateQueue(agentId: string): TaskQueue {
    let queue = this.agentQueues.get(agentId);
    if (!queue) {
      queue = new TaskQueue({
        logger: this.logger,
        maxQueueSize: this.maxQueueSizePerAgent,
      });
      this.agentQueues.set(agentId, queue);
      this.logger.info('Created task queue for agent', { agentId });
    }
    return queue;
  }

  /**
   * Get queue for specific agent
   * Returns tasks pending for that agent
   */
  getQueue(agentId: string): Task[] {
    const queue = this.agentQueues.get(agentId);
    if (!queue) {
      return [];
    }

    // Return both pending and assigned tasks for this agent
    const pending = queue.getAllTasks();
    const assigned = queue.getAssignedTasks();

    return [...pending, ...assigned];
  }

  /**
   * Get all tasks across all agents
   * Returns map of agent ID → tasks
   */
  getAllTasks(): Map<string, Task[]> {
    const result = new Map<string, Task[]>();

    for (const [agentId, _queue] of this.agentQueues.entries()) {
      const tasks = this.getQueue(agentId);
      if (tasks.length > 0) {
        result.set(agentId, tasks);
      }
    }

    return result;
  }

  /**
   * Get task by ID (searches all queues)
   */
  getTaskById(taskId: string): Task | undefined {
    // Check all tasks map first
    if (this.allTasks.has(taskId)) {
      return this.allTasks.get(taskId);
    }

    // Search all agent queues
    for (const queue of this.agentQueues.values()) {
      const task = queue.getTaskById(taskId);
      if (task) {
        return task;
      }
    }

    return undefined;
  }

  /**
   * Add task to agent's queue
   */
  addTask(agentId: string, task: Task): void {
    const queue = this.getOrCreateQueue(agentId);

    try {
      queue.enqueue(task, this.allTasks);
      this.allTasks.set(task.id, task);

      this.logger.info('Task added to agent queue', {
        taskId: task.id,
        agentId,
        queueSize: queue.size(),
      });

      // Notify task-added callbacks
      for (const cb of this.taskAddedCallbacks) {
        try {
          cb(agentId, task);
        } catch (err) {
          this.logger.error('Error in onTaskAdded callback', {
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to add task to queue', {
        taskId: task.id,
        agentId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Remove (cancel) task from any queue
   */
  removeTask(taskId: string): boolean {
    // Remove from all tasks map
    this.allTasks.delete(taskId);

    // Search all queues and remove
    for (const [agentId, queue] of this.agentQueues.entries()) {
      if (queue.remove(taskId)) {
        this.logger.info('Task cancelled', { taskId, agentId });
        return true;
      }
    }

    this.logger.warn('Task not found for cancellation', { taskId });
    return false;
  }

  /**
   * Get queue statistics for an agent
   */
  getAgentStats(agentId: string): {
    pending: number;
    assigned: number;
    total: number;
  } | null {
    const queue = this.agentQueues.get(agentId);
    if (!queue) {
      return null;
    }

    const stats = queue.getStats();
    return {
      pending: stats.queueSize,
      assigned: stats.assignedCount,
      total: stats.queueSize + stats.assignedCount,
    };
  }

  /**
   * Get overall statistics
   */
  getOverallStats(): {
    totalAgents: number;
    totalTasks: number;
    totalPending: number;
    totalAssigned: number;
  } {
    let totalPending = 0;
    let totalAssigned = 0;

    for (const queue of this.agentQueues.values()) {
      const stats = queue.getStats();
      totalPending += stats.queueSize;
      totalAssigned += stats.assignedCount;
    }

    return {
      totalAgents: this.agentQueues.size,
      totalTasks: totalPending + totalAssigned,
      totalPending,
      totalAssigned,
    };
  }

  /**
   * Check if agent has tasks
   */
  hasTasksFor(agentId: string): boolean {
    const queue = this.agentQueues.get(agentId);
    return queue ? queue.size() > 0 || queue.assignedCount() > 0 : false;
  }

  /**
   * Clear all tasks for an agent
   */
  clearAgentQueue(agentId: string): void {
    const queue = this.agentQueues.get(agentId);
    if (queue) {
      queue.clear();
      this.logger.info('Agent queue cleared', { agentId });
    }
  }

  /**
   * Clear all tasks
   */
  clearAll(): void {
    for (const queue of this.agentQueues.values()) {
      queue.clear();
    }
    this.agentQueues.clear();
    this.allTasks.clear();
    this.logger.info('All task queues cleared');
  }

  /**
   * Expose raw TaskQueue for lifecycle operations (used by TaskWorker)
   */
  getTaskQueue(agentId: string): TaskQueue | undefined {
    return this.agentQueues.get(agentId);
  }

  /**
   * Register callback for task additions (used to wake the worker)
   * Returns unsubscribe function
   */
  onTaskAdded(callback: (agentId: string, task: Task) => void): () => void {
    this.taskAddedCallbacks.add(callback);
    return () => this.taskAddedCallbacks.delete(callback);
  }
}

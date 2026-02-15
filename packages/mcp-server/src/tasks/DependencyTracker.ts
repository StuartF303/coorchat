/**
 * DependencyTracker - Track task dependencies and notify when dependencies complete
 * Manages task dependency graph and triggers notifications for unblocked tasks
 */

import type { Task, TaskStatus } from './Task.js';
import { TaskStatus as TaskStatusEnum } from './Task.js';
import type { Logger } from '../logging/Logger.js';
import { createLogger } from '../logging/Logger.js';

/**
 * Dependency event
 */
export interface DependencyEvent {
  /** Task that was unblocked */
  task: Task;

  /** Dependencies that were completed */
  completedDependencies: string[];

  /** Timestamp */
  timestamp: Date;
}

/**
 * Dependency event handler
 */
export type DependencyEventHandler = (event: DependencyEvent) => void | Promise<void>;

/**
 * Dependency tracker configuration
 */
export interface DependencyTrackerConfig {
  /** Logger */
  logger?: Logger;
}

/**
 * Dependency graph node
 */
interface DependencyNode {
  taskId: string;
  dependencies: Set<string>; // Task IDs this task depends on
  dependents: Set<string>; // Task IDs that depend on this task
  status: TaskStatus;
}

/**
 * DependencyTracker class
 */
export class DependencyTracker {
  private logger: Logger;
  private nodes: Map<string, DependencyNode>; // taskId → node
  private eventHandlers: Set<DependencyEventHandler>;

  constructor(config: DependencyTrackerConfig = {}) {
    this.logger = config.logger || createLogger();
    this.nodes = new Map();
    this.eventHandlers = new Set();
  }

  /**
   * Add task to dependency graph
   */
  addTask(task: Task): void {
    // Create or update node
    let node = this.nodes.get(task.id);
    if (!node) {
      node = {
        taskId: task.id,
        dependencies: new Set(task.dependencies),
        dependents: new Set(),
        status: task.status,
      };
      this.nodes.set(task.id, node);
    } else {
      node.dependencies = new Set(task.dependencies);
      node.status = task.status;
    }

    // Update reverse dependencies (dependents)
    for (const depId of task.dependencies) {
      let depNode = this.nodes.get(depId);
      if (!depNode) {
        // Create placeholder node for dependency
        depNode = {
          taskId: depId,
          dependencies: new Set(),
          dependents: new Set(),
          status: TaskStatusEnum.AVAILABLE,
        };
        this.nodes.set(depId, depNode);
      }
      depNode.dependents.add(task.id);
    }

    this.logger.debug('Task added to dependency tracker', {
      taskId: task.id,
      dependencies: task.dependencies,
      status: task.status,
    });
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    const node = this.nodes.get(taskId);
    if (!node) {
      this.logger.warn('Task not found in dependency tracker', { taskId });
      return;
    }

    const previousStatus = node.status;
    node.status = status;

    this.logger.debug('Task status updated', {
      taskId,
      previousStatus,
      newStatus: status,
    });

    // If task is now completed, check if any dependents are unblocked
    if (status === TaskStatusEnum.COMPLETED) {
      await this.checkUnblockedDependents(taskId);
    }
  }

  /**
   * Check if completing a task unblocks any dependents
   */
  private async checkUnblockedDependents(completedTaskId: string): Promise<void> {
    const node = this.nodes.get(completedTaskId);
    if (!node) {
      return;
    }

    // Check each dependent
    for (const dependentId of node.dependents) {
      const dependentNode = this.nodes.get(dependentId);
      if (!dependentNode) {
        continue;
      }

      // Check if all dependencies are completed
      const allDepsCompleted = Array.from(dependentNode.dependencies).every(
        (depId) => {
          const depNode = this.nodes.get(depId);
          return depNode?.status === TaskStatusEnum.COMPLETED;
        }
      );

      if (allDepsCompleted && dependentNode.status === TaskStatusEnum.AVAILABLE) {
        // Task is unblocked!
        const completedDeps = Array.from(dependentNode.dependencies);

        // Reconstruct task for event (simplified)
        const task: Partial<Task> = {
          id: dependentNode.taskId,
          status: dependentNode.status,
          dependencies: completedDeps,
        };

        await this.notifyHandlers({
          task: task as Task,
          completedDependencies: completedDeps,
          timestamp: new Date(),
        });

        this.logger.info('Task unblocked', {
          taskId: dependentId,
          completedDependencies: completedDeps,
        });
      }
    }
  }

  /**
   * Check if a task has all dependencies completed
   */
  areDependenciesCompleted(taskId: string): boolean {
    const node = this.nodes.get(taskId);
    if (!node) {
      return false;
    }

    return Array.from(node.dependencies).every((depId) => {
      const depNode = this.nodes.get(depId);
      return depNode?.status === TaskStatusEnum.COMPLETED;
    });
  }

  /**
   * Get blocking dependencies for a task
   */
  getBlockingDependencies(taskId: string): string[] {
    const node = this.nodes.get(taskId);
    if (!node) {
      return [];
    }

    return Array.from(node.dependencies).filter((depId) => {
      const depNode = this.nodes.get(depId);
      return depNode?.status !== TaskStatusEnum.COMPLETED;
    });
  }

  /**
   * Get all dependents of a task
   */
  getDependents(taskId: string): string[] {
    const node = this.nodes.get(taskId);
    if (!node) {
      return [];
    }

    return Array.from(node.dependents);
  }

  /**
   * Get task dependency chain (recursive)
   */
  getDependencyChain(taskId: string, visited: Set<string> = new Set()): string[] {
    if (visited.has(taskId)) {
      // Circular dependency detected
      this.logger.warn('Circular dependency detected', { taskId });
      return [];
    }

    visited.add(taskId);

    const node = this.nodes.get(taskId);
    if (!node) {
      return [];
    }

    const chain: string[] = [];
    for (const depId of node.dependencies) {
      chain.push(depId);
      chain.push(...this.getDependencyChain(depId, visited));
    }

    return chain;
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies(): string[][] {
    const cycles: string[][] = [];

    for (const [taskId] of this.nodes) {
      const visited = new Set<string>();
      const path: string[] = [];

      const hasCycle = this.detectCycleFromNode(taskId, visited, path);
      if (hasCycle && path.length > 0) {
        cycles.push([...path]);
      }
    }

    return cycles;
  }

  /**
   * Detect cycle from a specific node (DFS)
   */
  private detectCycleFromNode(
    taskId: string,
    visited: Set<string>,
    path: string[]
  ): boolean {
    if (path.includes(taskId)) {
      // Found a cycle
      path.push(taskId);
      return true;
    }

    if (visited.has(taskId)) {
      return false;
    }

    visited.add(taskId);
    path.push(taskId);

    const node = this.nodes.get(taskId);
    if (node) {
      for (const depId of node.dependencies) {
        if (this.detectCycleFromNode(depId, visited, path)) {
          return true;
        }
      }
    }

    path.pop();
    return false;
  }

  /**
   * Remove task from tracker
   */
  removeTask(taskId: string): void {
    const node = this.nodes.get(taskId);
    if (!node) {
      return;
    }

    // Remove from dependents' dependency lists
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependents.delete(taskId);
      }
    }

    // Remove from dependencies' dependent lists
    for (const dependentId of node.dependents) {
      const dependentNode = this.nodes.get(dependentId);
      if (dependentNode) {
        dependentNode.dependencies.delete(taskId);
      }
    }

    this.nodes.delete(taskId);
    this.logger.debug('Task removed from dependency tracker', { taskId });
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.nodes.clear();
    this.logger.info('Dependency tracker cleared');
  }

  /**
   * Register dependency event handler
   */
  onDependencyResolved(handler: DependencyEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Notify handlers
   */
  private async notifyHandlers(event: DependencyEvent): Promise<void> {
    const promises = Array.from(this.eventHandlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error('Error in dependency handler', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    });

    await Promise.all(promises);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTasks: number;
    tasksWithDependencies: number;
    averageDependencies: number;
    circularDependencies: number;
  } {
    const tasksWithDeps = Array.from(this.nodes.values()).filter(
      (node) => node.dependencies.size > 0
    ).length;

    const totalDeps = Array.from(this.nodes.values()).reduce(
      (sum, node) => sum + node.dependencies.size,
      0
    );

    const avgDeps = this.nodes.size > 0 ? totalDeps / this.nodes.size : 0;

    const cycles = this.detectCircularDependencies();

    return {
      totalTasks: this.nodes.size,
      tasksWithDependencies: tasksWithDeps,
      averageDependencies: Math.round(avgDeps * 100) / 100,
      circularDependencies: cycles.length,
    };
  }
}

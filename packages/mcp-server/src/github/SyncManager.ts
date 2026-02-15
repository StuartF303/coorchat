/**
 * SyncManager - Orchestrate webhook + polling, deduplicate events, map issues → tasks
 */

import { v4 as uuidv4 } from 'uuid';
import type { GitHubClient, GitHubWebhookEvent, GitHubIssue } from './GitHubClient.js';
import type { WebhookHandler } from './WebhookHandler.js';
import type { PollingService, PollingEvent } from './PollingService.js';
import type { Task, TaskCreation } from '../tasks/Task.js';
import { createTask } from '../tasks/Task.js';
import type { Logger } from '../logging/Logger.js';
import { createLogger } from '../logging/Logger.js';

/**
 * Sync event (deduplicated GitHub event → task creation)
 */
export interface SyncEvent {
  /** Event type */
  type: 'task_created' | 'task_updated' | 'task_closed';

  /** Created/updated task */
  task: Task;

  /** Original GitHub issue */
  issue: GitHubIssue;

  /** Event source */
  source: 'webhook' | 'polling';
}

/**
 * Sync event handler
 */
export type SyncEventHandler = (event: SyncEvent) => void | Promise<void>;

/**
 * SyncManager configuration
 */
export interface SyncManagerConfig {
  /** GitHub client */
  client: GitHubClient;

  /** Webhook handler (optional) */
  webhookHandler?: WebhookHandler;

  /** Polling service (optional) */
  pollingService?: PollingService;

  /** Logger */
  logger?: Logger;

  /** Deduplication window in milliseconds */
  deduplicationWindowMs?: number;
}

/**
 * Event deduplication entry
 */
interface DeduplicationEntry {
  issueNumber: number;
  action: string;
  timestamp: Date;
}

/**
 * SyncManager class
 */
export class SyncManager {
  public readonly client: GitHubClient;
  private webhookHandler?: WebhookHandler;
  private pollingService?: PollingService;
  private logger: Logger;
  private eventHandlers: Set<SyncEventHandler>;
  private isRunning: boolean;
  private deduplicationWindowMs: number;
  private recentEvents: DeduplicationEntry[];
  private taskCache: Map<number, Task>; // issueNumber → Task

  constructor(config: SyncManagerConfig) {
    this.client = config.client;
    this.webhookHandler = config.webhookHandler;
    this.pollingService = config.pollingService;
    this.logger = config.logger || createLogger();
    this.eventHandlers = new Set();
    this.isRunning = false;
    this.deduplicationWindowMs = config.deduplicationWindowMs || 5000; // 5 seconds
    this.recentEvents = [];
    this.taskCache = new Map();
  }

  /**
   * Start sync manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('SyncManager already running');
      return;
    }

    this.isRunning = true;

    // Start webhook handler if configured
    if (this.webhookHandler) {
      this.webhookHandler.onEvent(this.handleWebhookEvent.bind(this));
      if (!this.webhookHandler.isRunning()) {
        await this.webhookHandler.start();
      }
      this.logger.info('Webhook handler attached');
    }

    // Start polling service if configured
    if (this.pollingService) {
      this.pollingService.onEvent(this.handlePollingEvent.bind(this));
      this.pollingService.start();
      this.logger.info('Polling service attached');
    }

    // Start deduplication cleanup timer
    this.startDeduplicationCleanup();

    this.logger.info('SyncManager started');
  }

  /**
   * Stop sync manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop webhook handler
    if (this.webhookHandler?.isRunning()) {
      await this.webhookHandler.stop();
    }

    // Stop polling service
    if (this.pollingService) {
      this.pollingService.stop();
    }

    this.logger.info('SyncManager stopped');
  }

  /**
   * Handle webhook event
   */
  private async handleWebhookEvent(event: GitHubWebhookEvent): Promise<void> {
    try {
      if (event.type !== 'issues' || !event.issue) {
        return; // Only handle issue events
      }

      const action = event.action || 'unknown';
      const issue = event.issue;

      // Check for duplicates
      if (this.isDuplicate(issue.number, action, 'webhook')) {
        this.logger.debug('Duplicate webhook event ignored', {
          issueNumber: issue.number,
          action,
        });
        return;
      }

      // Process event
      await this.processIssueEvent(issue, action, 'webhook');
    } catch (error) {
      this.logger.error('Error handling webhook event', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Handle polling event
   */
  private async handlePollingEvent(event: PollingEvent): Promise<void> {
    try {
      if (!event.issue) {
        return; // Only handle issue events
      }

      const action = event.type === 'new_issue' ? 'opened' : 'updated';
      const issue = event.issue;

      // Check for duplicates
      if (this.isDuplicate(issue.number, action, 'polling')) {
        this.logger.debug('Duplicate polling event ignored', {
          issueNumber: issue.number,
          action,
        });
        return;
      }

      // Process event
      await this.processIssueEvent(issue, action, 'polling');
    } catch (error) {
      this.logger.error('Error handling polling event', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Process issue event
   */
  private async processIssueEvent(
    issue: GitHubIssue,
    action: string,
    source: 'webhook' | 'polling'
  ): Promise<void> {
    // Map to sync event type
    let syncType: SyncEvent['type'];
    if (action === 'opened') {
      syncType = 'task_created';
    } else if (action === 'closed') {
      syncType = 'task_closed';
    } else {
      syncType = 'task_updated';
    }

    // Get or create task
    let task = this.taskCache.get(issue.number);

    if (!task && syncType === 'task_created') {
      // Create new task from issue
      task = this.issueToTask(issue);
      this.taskCache.set(issue.number, task);
    } else if (task) {
      // Update existing task from issue
      task = this.updateTaskFromIssue(task, issue, action);
      this.taskCache.set(issue.number, task);
    } else {
      // Task not in cache but event is not 'opened' - fetch from issue
      task = this.issueToTask(issue);
      this.taskCache.set(issue.number, task);
      syncType = 'task_created'; // Treat as new
    }

    // Notify handlers
    await this.notifyHandlers({
      type: syncType,
      task,
      issue,
      source,
    });

    this.logger.info('Synced issue to task', {
      issueNumber: issue.number,
      taskId: task.id,
      action,
      source,
    });
  }

  /**
   * Map GitHub issue to Task
   */
  private issueToTask(issue: GitHubIssue): Task {
    const taskData: TaskCreation = {
      description: issue.title,
      dependencies: [],
      githubIssueId: String(issue.number),
      githubIssueUrl: issue.htmlUrl,
    };

    return createTask(uuidv4(), taskData);
  }

  /**
   * Update task from issue
   */
  private updateTaskFromIssue(task: Task, issue: GitHubIssue, action: string): Task {
    // Update description if title changed
    if (task.description !== issue.title) {
      task = { ...task, description: issue.title };
    }

    // Update status based on issue state
    if (action === 'closed' && issue.state === 'closed') {
      task = { ...task, completedAt: new Date() };
    }

    return task;
  }

  /**
   * Check if event is a duplicate
   */
  private isDuplicate(
    issueNumber: number,
    action: string,
    _source: 'webhook' | 'polling'
  ): boolean {
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.deduplicationWindowMs);

    // Check recent events
    const isDup = this.recentEvents.some(
      (entry) =>
        entry.issueNumber === issueNumber &&
        entry.action === action &&
        entry.timestamp > cutoff
    );

    if (!isDup) {
      // Record this event
      this.recentEvents.push({
        issueNumber,
        action,
        timestamp: now,
      });
    }

    return isDup;
  }

  /**
   * Start deduplication cleanup timer
   */
  private startDeduplicationCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - this.deduplicationWindowMs);

      // Remove old entries
      this.recentEvents = this.recentEvents.filter(
        (entry) => entry.timestamp > cutoff
      );
    }, this.deduplicationWindowMs);
  }

  /**
   * Register sync event handler
   */
  onSync(handler: SyncEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Notify all handlers
   */
  private async notifyHandlers(event: SyncEvent): Promise<void> {
    const promises = Array.from(this.eventHandlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error('Error in sync handler', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    });

    await Promise.all(promises);
  }

  /**
   * Get task by GitHub issue number
   */
  getTaskByIssueNumber(issueNumber: number): Task | undefined {
    return this.taskCache.get(issueNumber);
  }

  /**
   * Get all synced tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.taskCache.values());
  }

  /**
   * Clear task cache
   */
  clearCache(): void {
    this.taskCache.clear();
    this.logger.info('Task cache cleared');
  }

  /**
   * Get sync status
   */
  getStatus(): {
    running: boolean;
    webhookEnabled: boolean;
    pollingEnabled: boolean;
    cachedTasks: number;
    recentEvents: number;
  } {
    return {
      running: this.isRunning,
      webhookEnabled: this.webhookHandler !== undefined,
      pollingEnabled: this.pollingService !== undefined,
      cachedTasks: this.taskCache.size,
      recentEvents: this.recentEvents.length,
    };
  }
}

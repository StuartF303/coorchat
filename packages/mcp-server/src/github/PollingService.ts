/**
 * PollingService - Fallback polling with conditional requests (ETags)
 * Polls GitHub API at regular intervals with optimization using ETags
 */

import type { GitHubClient, GitHubIssue, GitHubPullRequest } from './GitHubClient.js';
import type { Logger } from '../logging/Logger.js';
import { createLogger } from '../logging/Logger.js';

/**
 * Polling event types
 */
export type PollingEventType = 'issue_updated' | 'pr_updated' | 'new_issue' | 'new_pr';

/**
 * Polling event
 */
export interface PollingEvent {
  type: PollingEventType;
  issue?: GitHubIssue;
  pullRequest?: GitHubPullRequest;
  previousState?: any;
}

/**
 * Polling event handler
 */
export type PollingEventHandler = (event: PollingEvent) => void | Promise<void>;

/**
 * Polling service configuration
 */
export interface PollingServiceConfig {
  /** GitHub client instance */
  client: GitHubClient;

  /** Polling interval in milliseconds */
  intervalMs?: number;

  /** Logger instance */
  logger?: Logger;

  /** Whether to poll issues */
  pollIssues?: boolean;

  /** Whether to poll pull requests */
  pollPullRequests?: boolean;
}

/**
 * Cached state for conditional requests
 */
interface CachedState {
  etag?: string;
  lastModified?: Date;
  data: Map<number, GitHubIssue | GitHubPullRequest>;
}

/**
 * PollingService class
 */
export class PollingService {
  private client: GitHubClient;
  private config: Required<Omit<PollingServiceConfig, 'client'>>;
  private logger: Logger;
  private eventHandlers: Set<PollingEventHandler>;
  private timer?: NodeJS.Timeout;
  private isRunning: boolean;
  private issueCache: CachedState;
  private prCache: CachedState;

  constructor(config: PollingServiceConfig) {
    this.client = config.client;
    this.config = {
      intervalMs: config.intervalMs || 30000, // 30 seconds default
      logger: config.logger || createLogger(),
      pollIssues: config.pollIssues ?? true,
      pollPullRequests: config.pollPullRequests ?? true,
    };
    this.logger = this.config.logger;
    this.eventHandlers = new Set();
    this.isRunning = false;
    this.issueCache = { data: new Map() };
    this.prCache = { data: new Map() };
  }

  /**
   * Start polling
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Polling service already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting polling service', {
      intervalMs: this.config.intervalMs,
    });

    // Run initial poll immediately
    this.poll().catch((error) => {
      this.logger.error('Error in initial poll', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });

    // Schedule periodic polling
    this.timer = setInterval(() => {
      this.poll().catch((error) => {
        this.logger.error('Error in polling', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    }, this.config.intervalMs);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    this.logger.info('Stopped polling service');
  }

  /**
   * Perform a poll
   */
  private async poll(): Promise<void> {
    const startTime = Date.now();

    try {
      // Poll issues if enabled
      if (this.config.pollIssues) {
        await this.pollIssues();
      }

      // Poll pull requests if enabled
      if (this.config.pollPullRequests) {
        await this.pollPullRequests();
      }

      const duration = Date.now() - startTime;
      this.logger.debug('Poll completed', { duration });
    } catch (error) {
      this.logger.error('Poll failed', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Poll issues
   */
  private async pollIssues(): Promise<void> {
    try {
      // Fetch issues (GitHub API will use If-None-Match header with ETag automatically)
      const since = this.issueCache.lastModified;
      const issues = await this.client.listIssues({
        state: 'open',
        since,
      });

      // Detect changes
      const newData = new Map<number, GitHubIssue>();
      for (const issue of issues) {
        newData.set(issue.number, issue);

        const cached = this.issueCache.data.get(issue.number);
        if (!cached) {
          // New issue
          await this.notifyHandlers({
            type: 'new_issue',
            issue,
          });
        } else if (cached.updatedAt.getTime() !== issue.updatedAt.getTime()) {
          // Updated issue
          await this.notifyHandlers({
            type: 'issue_updated',
            issue,
            previousState: cached,
          });
        }
      }

      // Update cache
      this.issueCache.data = newData;
      this.issueCache.lastModified = new Date();
    } catch (error) {
      this.logger.error('Error polling issues', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Poll pull requests
   */
  private async pollPullRequests(): Promise<void> {
    try {
      const pullRequests = await this.client.listPullRequests({
        state: 'open',
      });

      // Detect changes
      const newData = new Map<number, GitHubPullRequest>();
      for (const pr of pullRequests) {
        newData.set(pr.number, pr);

        const cached = this.prCache.data.get(pr.number);
        if (!cached) {
          // New PR
          await this.notifyHandlers({
            type: 'new_pr',
            pullRequest: pr,
          });
        } else if (cached.updatedAt.getTime() !== pr.updatedAt.getTime()) {
          // Updated PR
          await this.notifyHandlers({
            type: 'pr_updated',
            pullRequest: pr,
            previousState: cached,
          });
        }
      }

      // Update cache
      this.prCache.data = newData;
      this.prCache.lastModified = new Date();
    } catch (error) {
      this.logger.error('Error polling pull requests', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Register event handler
   */
  onEvent(handler: PollingEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Notify all handlers of an event
   */
  private async notifyHandlers(event: PollingEvent): Promise<void> {
    const promises = Array.from(this.eventHandlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error('Error in polling handler', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    });

    await Promise.all(promises);
  }

  /**
   * Check if service is running
   */
  getStatus(): {
    running: boolean;
    intervalMs: number;
    lastPoll?: Date;
    cachedIssues: number;
    cachedPRs: number;
  } {
    return {
      running: this.isRunning,
      intervalMs: this.config.intervalMs,
      lastPoll: this.issueCache.lastModified || this.prCache.lastModified,
      cachedIssues: this.issueCache.data.size,
      cachedPRs: this.prCache.data.size,
    };
  }

  /**
   * Force an immediate poll
   */
  async pollNow(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Polling service is not running');
    }

    await this.poll();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.issueCache = { data: new Map() };
    this.prCache = { data: new Map() };
    this.logger.info('Cache cleared');
  }
}

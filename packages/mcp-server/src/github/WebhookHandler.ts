/**
 * WebhookHandler - Express endpoint for GitHub webhook events
 * Validates webhook signatures and parses issue/PR events
 */

import express, { Request, Response, Application } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Logger } from '../logging/Logger.js';
import { createLogger } from '../logging/Logger.js';
import { GitHubWebhookEvent, GitHubIssue, GitHubPullRequest } from './GitHubClient.js';

/**
 * Webhook event handler callback
 */
export type WebhookEventHandler = (event: GitHubWebhookEvent) => void | Promise<void>;

/**
 * Webhook handler configuration
 */
export interface WebhookHandlerConfig {
  /** Webhook secret for signature validation */
  secret?: string;

  /** Port to listen on */
  port?: number;

  /** Path for webhook endpoint */
  path?: string;

  /** Logger instance */
  logger?: Logger;

  /** Whether to verify signatures */
  verifySignature?: boolean;
}

/**
 * WebhookHandler class
 */
export class WebhookHandler {
  private app: Application;
  private config: Required<WebhookHandlerConfig>;
  private logger: Logger;
  private eventHandlers: Set<WebhookEventHandler>;
  private server?: ReturnType<Application['listen']>;

  constructor(config: WebhookHandlerConfig = {}) {
    this.config = {
      secret: config.secret || '',
      port: config.port || 3000,
      path: config.path || '/webhook',
      logger: config.logger || createLogger(),
      verifySignature: config.verifySignature ?? true,
    };
    this.logger = this.config.logger;
    this.eventHandlers = new Set();
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Raw body parser for signature verification
    this.app.use(
      express.json({
        verify: (req: any, res, buf) => {
          req.rawBody = buf.toString('utf-8');
        },
      })
    );
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Webhook endpoint
    this.app.post(this.config.path, this.handleWebhook.bind(this));
  }

  /**
   * Handle incoming webhook
   */
  private async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Verify signature if enabled
      if (this.config.verifySignature) {
        const isValid = this.verifySignature(
          req.headers['x-hub-signature-256'] as string,
          (req as any).rawBody
        );

        if (!isValid) {
          this.logger.warn('Invalid webhook signature');
          res.status(401).json({ error: 'Invalid signature' });
          return;
        }
      }

      // Get event type from header
      const eventType = req.headers['x-github-event'] as string;
      const deliveryId = req.headers['x-github-delivery'] as string;

      this.logger.debug('Received webhook event', {
        eventType,
        deliveryId,
      });

      // Parse event
      const event = this.parseEvent(eventType, req.body);

      // Notify handlers
      await this.notifyHandlers(event);

      res.status(200).json({ received: true });
    } catch (error) {
      this.logger.error('Error handling webhook', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Verify webhook signature
   */
  private verifySignature(signature: string | undefined, body: string): boolean {
    if (!signature || !this.config.secret) {
      return !this.config.verifySignature; // Skip verification if no secret configured
    }

    try {
      const hmac = createHmac('sha256', this.config.secret);
      hmac.update(body);
      const expectedSignature = `sha256=${hmac.digest('hex')}`;

      // Use timing-safe comparison
      return timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      this.logger.error('Error verifying signature', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  /**
   * Parse webhook event
   */
  private parseEvent(eventType: string, payload: any): GitHubWebhookEvent {
    switch (eventType) {
      case 'issues':
        return this.parseIssueEvent(payload);

      case 'pull_request':
        return this.parsePullRequestEvent(payload);

      case 'push':
        return this.parsePushEvent(payload);

      default:
        return {
          type: 'unknown',
          repository: {
            owner: payload.repository?.owner?.login || 'unknown',
            name: payload.repository?.name || 'unknown',
          },
        };
    }
  }

  /**
   * Parse issue event
   */
  private parseIssueEvent(payload: any): GitHubWebhookEvent {
    const issue: GitHubIssue = {
      id: payload.issue.id,
      number: payload.issue.number,
      title: payload.issue.title,
      body: payload.issue.body,
      state: payload.issue.state,
      url: payload.issue.url,
      htmlUrl: payload.issue.html_url,
      createdAt: new Date(payload.issue.created_at),
      updatedAt: new Date(payload.issue.updated_at),
      labels: payload.issue.labels.map((label: any) => label.name),
      assignees: payload.issue.assignees.map((assignee: any) => assignee.login),
    };

    return {
      type: 'issues',
      action: payload.action,
      issue,
      repository: {
        owner: payload.repository.owner.login,
        name: payload.repository.name,
      },
    };
  }

  /**
   * Parse pull request event
   */
  private parsePullRequestEvent(payload: any): GitHubWebhookEvent {
    const pullRequest: GitHubPullRequest = {
      id: payload.pull_request.id,
      number: payload.pull_request.number,
      title: payload.pull_request.title,
      body: payload.pull_request.body,
      state: payload.pull_request.state,
      url: payload.pull_request.url,
      htmlUrl: payload.pull_request.html_url,
      createdAt: new Date(payload.pull_request.created_at),
      updatedAt: new Date(payload.pull_request.updated_at),
      head: payload.pull_request.head.ref,
      base: payload.pull_request.base.ref,
      mergeable: payload.pull_request.mergeable,
    };

    return {
      type: 'pull_request',
      action: payload.action,
      pullRequest,
      repository: {
        owner: payload.repository.owner.login,
        name: payload.repository.name,
      },
    };
  }

  /**
   * Parse push event
   */
  private parsePushEvent(payload: any): GitHubWebhookEvent {
    return {
      type: 'push',
      action: 'pushed',
      repository: {
        owner: payload.repository.owner.login,
        name: payload.repository.name,
      },
    };
  }

  /**
   * Register event handler
   */
  onEvent(handler: WebhookEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Notify all handlers of an event
   */
  private async notifyHandlers(event: GitHubWebhookEvent): Promise<void> {
    const promises = Array.from(this.eventHandlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error('Error in webhook handler', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    });

    await Promise.all(promises);
  }

  /**
   * Start the webhook server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, () => {
          this.logger.info('Webhook server started', {
            port: this.config.port,
            path: this.config.path,
          });
          resolve();
        });

        this.server.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the webhook server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          reject(error);
        } else {
          this.logger.info('Webhook server stopped');
          this.server = undefined;
          resolve();
        }
      });
    });
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== undefined;
  }

  /**
   * Get server configuration
   */
  getConfig(): { port: number; path: string } {
    return {
      port: this.config.port,
      path: this.config.path,
    };
  }
}

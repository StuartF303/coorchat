/**
 * GitHubClient - Wrapper for GitHub API using @octokit/rest
 * Provides simplified interface for fetching issues, PRs, and managing webhooks
 */

import { Octokit } from '@octokit/rest';
import type { Logger } from '../logging/Logger.js';
import { createLogger } from '../logging/Logger.js';

/**
 * GitHub issue data
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  url: string;
  htmlUrl: string;
  createdAt: Date;
  updatedAt: Date;
  labels: string[];
  assignees: string[];
}

/**
 * GitHub pull request data
 */
export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  url: string;
  htmlUrl: string;
  createdAt: Date;
  updatedAt: Date;
  head: string;
  base: string;
  mergeable: boolean | null;
}

/**
 * GitHub webhook event
 */
export interface GitHubWebhookEvent {
  type: 'issues' | 'pull_request' | 'push' | 'unknown';
  action?: string;
  issue?: GitHubIssue;
  pullRequest?: GitHubPullRequest;
  repository: {
    owner: string;
    name: string;
  };
}

/**
 * GitHub client configuration
 */
export interface GitHubClientConfig {
  token: string;
  owner: string;
  repo: string;
  logger?: Logger;
}

/**
 * GitHubClient class
 */
export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private logger: Logger;

  constructor(config: GitHubClientConfig) {
    this.octokit = new Octokit({
      auth: config.token,
    });
    this.owner = config.owner;
    this.repo = config.repo;
    this.logger = config.logger || createLogger();
  }

  /**
   * Get a single issue by number
   */
  async getIssue(issueNumber: number): Promise<GitHubIssue> {
    try {
      const { data } = await this.octokit.rest.issues.get({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
      });

      return this.mapIssue(data);
    } catch (error) {
      this.logger.error(`Failed to fetch issue #${issueNumber}`, {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * List issues with optional filters
   */
  async listIssues(options?: {
    state?: 'open' | 'closed' | 'all';
    labels?: string[];
    since?: Date;
    perPage?: number;
  }): Promise<GitHubIssue[]> {
    try {
      const { data } = await this.octokit.rest.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        state: options?.state || 'open',
        labels: options?.labels?.join(','),
        since: options?.since?.toISOString(),
        per_page: options?.perPage || 30,
      });

      return data.filter((issue) => !issue.pull_request).map(this.mapIssue);
    } catch (error) {
      this.logger.error('Failed to list issues', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Get a single pull request by number
   */
  async getPullRequest(prNumber: number): Promise<GitHubPullRequest> {
    try {
      const { data } = await this.octokit.rest.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      return this.mapPullRequest(data);
    } catch (error) {
      this.logger.error(`Failed to fetch PR #${prNumber}`, {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * List pull requests with optional filters
   */
  async listPullRequests(options?: {
    state?: 'open' | 'closed' | 'all';
    head?: string;
    base?: string;
    perPage?: number;
  }): Promise<GitHubPullRequest[]> {
    try {
      const { data } = await this.octokit.rest.pulls.list({
        owner: this.owner,
        repo: this.repo,
        state: options?.state || 'open',
        head: options?.head,
        base: options?.base,
        per_page: options?.perPage || 30,
      });

      return data.map(this.mapPullRequest);
    } catch (error) {
      this.logger.error('Failed to list pull requests', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Create a comment on an issue
   */
  async createIssueComment(issueNumber: number, body: string): Promise<void> {
    try {
      await this.octokit.rest.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        body,
      });

      this.logger.info(`Created comment on issue #${issueNumber}`);
    } catch (error) {
      this.logger.error(`Failed to create comment on issue #${issueNumber}`, {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Update issue labels
   */
  async updateIssueLabels(
    issueNumber: number,
    labels: string[]
  ): Promise<void> {
    try {
      await this.octokit.rest.issues.setLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        labels,
      });

      this.logger.info(`Updated labels on issue #${issueNumber}`);
    } catch (error) {
      this.logger.error(`Failed to update labels on issue #${issueNumber}`, {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Assign issue to users
   */
  async assignIssue(issueNumber: number, assignees: string[]): Promise<void> {
    try {
      await this.octokit.rest.issues.addAssignees({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        assignees,
      });

      this.logger.info(`Assigned issue #${issueNumber} to ${assignees.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to assign issue #${issueNumber}`, {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Close an issue
   */
  async closeIssue(issueNumber: number): Promise<void> {
    try {
      await this.octokit.rest.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        state: 'closed',
      });

      this.logger.info(`Closed issue #${issueNumber}`);
    } catch (error) {
      this.logger.error(`Failed to close issue #${issueNumber}`, {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Get repository information
   */
  async getRepository(): Promise<{ owner: string; name: string; url: string }> {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo,
      });

      return {
        owner: data.owner.login,
        name: data.name,
        url: data.html_url,
      };
    } catch (error) {
      this.logger.error('Failed to fetch repository info', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Check rate limit status
   */
  async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
  }> {
    try {
      const { data } = await this.octokit.rest.rateLimit.get();

      return {
        limit: data.rate.limit,
        remaining: data.rate.remaining,
        reset: new Date(data.rate.reset * 1000),
      };
    } catch (error) {
      this.logger.error('Failed to fetch rate limit', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Map Octokit issue to our GitHubIssue interface
   */
  private mapIssue(data: any): GitHubIssue {
    return {
      id: data.id,
      number: data.number,
      title: data.title,
      body: data.body,
      state: data.state as 'open' | 'closed',
      url: data.url,
      htmlUrl: data.html_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      labels: data.labels.map((label: any) =>
        typeof label === 'string' ? label : label.name
      ),
      assignees: data.assignees.map((assignee: any) => assignee.login),
    };
  }

  /**
   * Map Octokit PR to our GitHubPullRequest interface
   */
  private mapPullRequest(data: any): GitHubPullRequest {
    return {
      id: data.id,
      number: data.number,
      title: data.title,
      body: data.body,
      state: data.state as 'open' | 'closed',
      url: data.url,
      htmlUrl: data.html_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      head: data.head.ref,
      base: data.base.ref,
      mergeable: data.mergeable,
    };
  }

  /**
   * Get owner and repo
   */
  getRepoInfo(): { owner: string; repo: string } {
    return {
      owner: this.owner,
      repo: this.repo,
    };
  }
}

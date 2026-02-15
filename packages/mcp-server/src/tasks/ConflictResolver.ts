/**
 * ConflictResolver - Timestamp-based first-come-first-served conflict resolution
 * Resolves conflicts when multiple agents claim the same task simultaneously
 */

import type { Logger } from '../logging/Logger.js';
import { createLogger } from '../logging/Logger.js';

/**
 * Task claim
 */
export interface TaskClaim {
  /** Task being claimed */
  taskId: string;

  /** Agent claiming the task */
  agentId: string;

  /** Timestamp when claim was made */
  claimedAt: Date;

  /** Correlation ID for idempotency */
  correlationId?: string;
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  /** Winner of the conflict */
  winner: TaskClaim;

  /** Losers of the conflict */
  losers: TaskClaim[];

  /** Reason for resolution */
  reason: string;
}

/**
 * Conflict resolver configuration
 */
export interface ConflictResolverConfig {
  /** Logger */
  logger?: Logger;

  /** Time window for detecting simultaneous claims (ms) */
  simultaneousWindowMs?: number;
}

/**
 * ConflictResolver class
 */
export class ConflictResolver {
  private logger: Logger;
  private simultaneousWindowMs: number;
  private pendingClaims: Map<string, TaskClaim[]>; // taskId → claims
  private seenCorrelationIds: Set<string>; // For idempotency

  constructor(config: ConflictResolverConfig = {}) {
    this.logger = config.logger || createLogger();
    this.simultaneousWindowMs = config.simultaneousWindowMs || 1000; // 1 second
    this.pendingClaims = new Map();
    this.seenCorrelationIds = new Set();
  }

  /**
   * Register a task claim
   * Returns winner immediately if no conflict, or after resolution window
   */
  async registerClaim(claim: TaskClaim): Promise<ConflictResolution | null> {
    // Check for duplicate claim (idempotency)
    if (claim.correlationId && this.seenCorrelationIds.has(claim.correlationId)) {
      this.logger.debug('Duplicate claim ignored (idempotency)', {
        taskId: claim.taskId,
        agentId: claim.agentId,
        correlationId: claim.correlationId,
      });
      return null;
    }

    // Record correlation ID
    if (claim.correlationId) {
      this.seenCorrelationIds.add(claim.correlationId);
    }

    // Get or create claims list for this task
    let claims = this.pendingClaims.get(claim.taskId);
    if (!claims) {
      claims = [];
      this.pendingClaims.set(claim.taskId, claims);
    }

    // Add claim to list
    claims.push(claim);

    this.logger.debug('Task claim registered', {
      taskId: claim.taskId,
      agentId: claim.agentId,
      claimedAt: claim.claimedAt,
      totalClaims: claims.length,
    });

    // Wait for simultaneous window to detect conflicts
    await this.waitForConflicts(claim.taskId);

    // Resolve conflicts
    return this.resolveClaims(claim.taskId);
  }

  /**
   * Wait for potential simultaneous claims
   */
  private async waitForConflicts(_taskId: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, this.simultaneousWindowMs);
    });
  }

  /**
   * Resolve claims for a task
   */
  private resolveClaims(taskId: string): ConflictResolution | null {
    const claims = this.pendingClaims.get(taskId);
    if (!claims || claims.length === 0) {
      return null;
    }

    // Remove from pending
    this.pendingClaims.delete(taskId);

    // Single claim - no conflict
    if (claims.length === 1) {
      this.logger.debug('No conflict - single claim', {
        taskId,
        agentId: claims[0].agentId,
      });
      return {
        winner: claims[0],
        losers: [],
        reason: 'No conflict - single claimant',
      };
    }

    // Multiple claims - resolve by earliest timestamp
    const sorted = claims.sort(
      (a, b) => a.claimedAt.getTime() - b.claimedAt.getTime()
    );

    const winner = sorted[0];
    const losers = sorted.slice(1);

    this.logger.info('Conflict resolved', {
      taskId,
      totalClaims: claims.length,
      winner: winner.agentId,
      losers: losers.map((c) => c.agentId),
      timeDifference: sorted[sorted.length - 1].claimedAt.getTime() - winner.claimedAt.getTime(),
    });

    return {
      winner,
      losers,
      reason: `First-come-first-served: ${winner.agentId} claimed at ${winner.claimedAt.toISOString()}`,
    };
  }

  /**
   * Check if a claim would create a conflict
   */
  wouldConflict(taskId: string): boolean {
    const claims = this.pendingClaims.get(taskId);
    return claims !== undefined && claims.length > 0;
  }

  /**
   * Get pending claims for a task
   */
  getPendingClaims(taskId: string): TaskClaim[] {
    return this.pendingClaims.get(taskId) || [];
  }

  /**
   * Cancel a claim (e.g., if agent disconnects before resolution)
   */
  cancelClaim(taskId: string, agentId: string): boolean {
    const claims = this.pendingClaims.get(taskId);
    if (!claims) {
      return false;
    }

    const index = claims.findIndex((c) => c.agentId === agentId);
    if (index !== -1) {
      claims.splice(index, 1);
      this.logger.info('Claim cancelled', { taskId, agentId });

      // Remove task from pending if no more claims
      if (claims.length === 0) {
        this.pendingClaims.delete(taskId);
      }

      return true;
    }

    return false;
  }

  /**
   * Clear all pending claims
   */
  clear(): void {
    this.pendingClaims.clear();
    this.seenCorrelationIds.clear();
    this.logger.info('All pending claims cleared');
  }

  /**
   * Clean up old correlation IDs (to prevent memory leak)
   */
  cleanupCorrelationIds(): void {
    // In a production system, you'd want to expire these after some time
    // For now, we'll keep a simple size limit
    if (this.seenCorrelationIds.size > 10000) {
      this.seenCorrelationIds.clear();
      this.logger.info('Correlation ID cache cleared');
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    pendingTasks: number;
    totalPendingClaims: number;
    cachedCorrelationIds: number;
  } {
    const totalClaims = Array.from(this.pendingClaims.values()).reduce(
      (sum, claims) => sum + claims.length,
      0
    );

    return {
      pendingTasks: this.pendingClaims.size,
      totalPendingClaims: totalClaims,
      cachedCorrelationIds: this.seenCorrelationIds.size,
    };
  }
}

/**
 * Create a task claim
 */
export function createTaskClaim(
  taskId: string,
  agentId: string,
  correlationId?: string
): TaskClaim {
  return {
    taskId,
    agentId,
    claimedAt: new Date(),
    correlationId,
  };
}

/**
 * AgentRegistry - Track connected agents, add/remove, get by ID/role
 * Maintains a registry of all agents participating in the coordination system
 */

import type { Agent, AgentQuery, AgentUpdate } from './Agent.js';
import {
  AgentStatus,
  matchesAgentQuery,
  isAgentActive,
  updateAgent,
  getAgentDisplayName,
} from './Agent.js';
import type { Logger } from '../logging/Logger.js';
import { createLogger } from '../logging/Logger.js';

/**
 * Agent event types
 */
export type AgentEventType = 'agent_added' | 'agent_updated' | 'agent_removed' | 'agent_timeout';

/**
 * Agent event
 */
export interface AgentEvent {
  type: AgentEventType;
  agent: Agent;
  timestamp: Date;
}

/**
 * Agent event handler
 */
export type AgentEventHandler = (event: AgentEvent) => void | Promise<void>;

/**
 * Agent registry configuration
 */
export interface AgentRegistryConfig {
  /** Logger */
  logger?: Logger;

  /** Timeout for agent inactivity (ms) */
  timeoutMs?: number;

  /** Whether to enable automatic timeout checking */
  enableTimeoutChecking?: boolean;
}

/**
 * AgentRegistry class
 */
export class AgentRegistry {
  private agents: Map<string, Agent>; // agentId → Agent
  private logger: Logger;
  private eventHandlers: Set<AgentEventHandler>;
  private timeoutMs: number;
  private enableTimeoutChecking: boolean;
  private timeoutCheckInterval?: NodeJS.Timeout;

  constructor(config: AgentRegistryConfig = {}) {
    this.agents = new Map();
    this.logger = config.logger || createLogger();
    this.eventHandlers = new Set();
    this.timeoutMs = config.timeoutMs || 30000; // 30 seconds default
    this.enableTimeoutChecking = config.enableTimeoutChecking ?? true;

    if (this.enableTimeoutChecking) {
      this.startTimeoutChecking();
    }
  }

  /**
   * Add agent to registry
   */
  async add(agent: Agent): Promise<void> {
    if (this.agents.has(agent.id)) {
      this.logger.warn('Agent already registered', { agentId: agent.id });
      return;
    }

    this.agents.set(agent.id, agent);

    await this.notifyHandlers({
      type: 'agent_added',
      agent,
      timestamp: new Date(),
    });

    this.logger.info('Agent added to registry', {
      agentId: agent.id,
      role: agent.role,
      displayName: getAgentDisplayName(agent),
    });
  }

  /**
   * Update agent in registry
   */
  async update(agentId: string, update: AgentUpdate): Promise<Agent | undefined> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      this.logger.warn('Agent not found for update', { agentId });
      return undefined;
    }

    const updatedAgent = updateAgent(agent, update);
    this.agents.set(agentId, updatedAgent);

    await this.notifyHandlers({
      type: 'agent_updated',
      agent: updatedAgent,
      timestamp: new Date(),
    });

    this.logger.debug('Agent updated', { agentId, update });

    return updatedAgent;
  }

  /**
   * Remove agent from registry
   */
  async remove(agentId: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    this.agents.delete(agentId);

    await this.notifyHandlers({
      type: 'agent_removed',
      agent,
      timestamp: new Date(),
    });

    this.logger.info('Agent removed from registry', {
      agentId,
      role: agent.role,
    });

    return true;
  }

  /**
   * Get agent by ID (exact match)
   */
  getById(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get agent by ID (case-insensitive)
   * Tries exact match first, then falls back to case-insensitive search
   */
  getByIdCaseInsensitive(agentId: string): Agent | undefined {
    // Try exact match first (fastest)
    const exact = this.agents.get(agentId);
    if (exact) {
      return exact;
    }

    // Fall back to case-insensitive search
    const lowerAgentId = agentId.toLowerCase();
    for (const [id, agent] of this.agents.entries()) {
      if (id.toLowerCase() === lowerAgentId) {
        return agent;
      }
    }

    return undefined;
  }

  /**
   * Get agents by role
   */
  getByRole(role: string): Agent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.role === role
    );
  }

  /**
   * Get agents by status
   */
  getByStatus(status: AgentStatus): Agent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.status === status
    );
  }

  /**
   * Find agents matching query
   */
  find(query: AgentQuery): Agent[] {
    return Array.from(this.agents.values()).filter((agent) =>
      matchesAgentQuery(agent, query)
    );
  }

  /**
   * Get all agents
   */
  getAll(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get active agents (connected and seen recently)
   */
  getActive(): Agent[] {
    return Array.from(this.agents.values()).filter((agent) =>
      isAgentActive(agent, this.timeoutMs)
    );
  }

  /**
   * Get agent count
   */
  count(): number {
    return this.agents.size;
  }

  /**
   * Check if agent exists
   */
  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Clear all agents
   */
  clear(): void {
    this.agents.clear();
    this.logger.info('Agent registry cleared');
  }

  /**
   * Update agent's last seen timestamp
   */
  async heartbeat(agentId: string): Promise<void> {
    await this.update(agentId, { lastSeenAt: new Date() });
  }

  /**
   * Start timeout checking
   */
  private startTimeoutChecking(): void {
    this.timeoutCheckInterval = setInterval(() => {
      this.checkTimeouts().catch((error) => {
        this.logger.error('Error checking timeouts', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    }, this.timeoutMs / 2); // Check at half the timeout interval
  }

  /**
   * Check for timed-out agents
   */
  private async checkTimeouts(): Promise<void> {
    const now = Date.now();
    const timedOutAgents: Agent[] = [];

    for (const agent of this.agents.values()) {
      const timeSinceLastSeen = now - agent.lastSeenAt.getTime();
      if (timeSinceLastSeen > this.timeoutMs && agent.status !== AgentStatus.DISCONNECTED) {
        timedOutAgents.push(agent);
      }
    }

    // Handle timed-out agents
    for (const agent of timedOutAgents) {
      this.logger.warn('Agent timed out', {
        agentId: agent.id,
        role: agent.role,
        lastSeenAt: agent.lastSeenAt,
      });

      // Update status to disconnected
      await this.update(agent.id, { status: AgentStatus.DISCONNECTED });

      // Notify handlers
      await this.notifyHandlers({
        type: 'agent_timeout',
        agent,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Stop timeout checking
   */
  stopTimeoutChecking(): void {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = undefined;
    }
  }

  /**
   * Register event handler
   */
  onEvent(handler: AgentEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Notify event handlers
   */
  private async notifyHandlers(event: AgentEvent): Promise<void> {
    const promises = Array.from(this.eventHandlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error('Error in agent event handler', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    });

    await Promise.all(promises);
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    total: number;
    active: number;
    connected: number;
    disconnected: number;
    byRole: Record<string, number>;
  } {
    const all = this.getAll();
    const active = this.getActive();
    const connected = this.getByStatus(AgentStatus.CONNECTED);
    const disconnected = this.getByStatus(AgentStatus.DISCONNECTED);

    // Count by role
    const byRole: Record<string, number> = {};
    for (const agent of all) {
      byRole[agent.role] = (byRole[agent.role] || 0) + 1;
    }

    return {
      total: all.length,
      active: active.length,
      connected: connected.length,
      disconnected: disconnected.length,
      byRole,
    };
  }

  /**
   * Cleanup (stop timeout checking)
   */
  destroy(): void {
    this.stopTimeoutChecking();
  }
}

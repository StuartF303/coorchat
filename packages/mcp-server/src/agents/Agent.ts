/**
 * Agent - Represents a specialized AI agent participating in coordination
 * Based on specs/001-multi-agent-coordination/data-model.md
 */

import { Capability, Platform } from './Capability.js';

/**
 * Agent connection status
 */
export enum AgentStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
}

/**
 * Agent entity
 */
export interface Agent {
  /** Unique agent identifier (UUID v4) */
  id: string;

  /** Agent role type (extensible: developer, tester, architect, custom roles) */
  role: string;

  /** Operating system platform */
  platform: Platform;

  /** Execution environment (local, GitHub Actions, Azure DevOps, AWS, etc.) */
  environment: string;

  /** Agent capability set */
  capabilities: Capability;

  /** Connection status */
  status: AgentStatus;

  /** ID of currently assigned task (optional) */
  currentTask?: string | null;

  /** When agent joined the channel */
  registeredAt: Date;

  /** Last activity timestamp */
  lastSeenAt: Date;
}

/**
 * Agent registration data (for initial join)
 */
export interface AgentRegistration {
  /** Agent role type */
  role: string;

  /** Operating system platform */
  platform: Platform;

  /** Execution environment */
  environment: string;

  /** Agent capabilities */
  capabilities: Capability;
}

/**
 * Agent update data
 */
export interface AgentUpdate {
  /** Update connection status */
  status?: AgentStatus;

  /** Update current task */
  currentTask?: string | null;

  /** Update last seen timestamp */
  lastSeenAt?: Date;

  /** Update capabilities */
  capabilities?: Partial<Capability>;
}

/**
 * Agent query filter
 */
export interface AgentQuery {
  /** Filter by role type */
  role?: string;

  /** Filter by platform */
  platform?: Platform;

  /** Filter by environment type */
  environment?: string;

  /** Filter by connection status */
  status?: AgentStatus;

  /** Filter by whether agent has current task */
  hasCurrentTask?: boolean;

  /** Filter by minimum last seen timestamp */
  lastSeenSince?: Date;
}

/**
 * Validate agent object
 */
export function validateAgent(agent: unknown): agent is Agent {
  if (typeof agent !== 'object' || agent === null) {
    return false;
  }

  const a = agent as Partial<Agent>;

  return (
    typeof a.id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      a.id
    ) &&
    typeof a.role === 'string' &&
    a.role.length > 0 &&
    a.role.length <= 50 &&
    typeof a.platform === 'string' &&
    ['Linux', 'macOS', 'Windows'].includes(a.platform) &&
    typeof a.environment === 'string' &&
    a.environment.length > 0 &&
    a.environment.length <= 100 &&
    typeof a.capabilities === 'object' &&
    typeof a.status === 'string' &&
    Object.values(AgentStatus).includes(a.status as AgentStatus) &&
    a.registeredAt instanceof Date &&
    a.lastSeenAt instanceof Date
  );
}

/**
 * Check if an agent matches a query
 */
export function matchesAgentQuery(agent: Agent, query: AgentQuery): boolean {
  if (query.role && agent.role !== query.role) {
    return false;
  }

  if (query.platform && agent.platform !== query.platform) {
    return false;
  }

  if (query.environment && agent.environment !== query.environment) {
    return false;
  }

  if (query.status && agent.status !== query.status) {
    return false;
  }

  if (query.hasCurrentTask !== undefined) {
    const hasTask = agent.currentTask !== null && agent.currentTask !== undefined;
    if (query.hasCurrentTask !== hasTask) {
      return false;
    }
  }

  if (query.lastSeenSince && agent.lastSeenAt < query.lastSeenSince) {
    return false;
  }

  return true;
}

/**
 * Create an agent from registration data
 */
export function createAgent(id: string, registration: AgentRegistration): Agent {
  const now = new Date();

  return {
    id,
    role: registration.role,
    platform: registration.platform,
    environment: registration.environment,
    capabilities: registration.capabilities,
    status: AgentStatus.CONNECTING,
    currentTask: null,
    registeredAt: now,
    lastSeenAt: now,
  };
}

/**
 * Update an agent with partial data
 */
export function updateAgent(agent: Agent, update: AgentUpdate): Agent {
  return {
    ...agent,
    ...(update.status !== undefined && { status: update.status }),
    ...(update.currentTask !== undefined && { currentTask: update.currentTask }),
    ...(update.lastSeenAt && { lastSeenAt: update.lastSeenAt }),
    ...(update.capabilities && {
      capabilities: { ...agent.capabilities, ...update.capabilities },
    }),
  };
}

/**
 * Check if an agent is active (connected and seen recently)
 */
export function isAgentActive(agent: Agent, timeoutMs: number = 30000): boolean {
  if (agent.status !== AgentStatus.CONNECTED) {
    return false;
  }

  const timeSinceLastSeen = Date.now() - agent.lastSeenAt.getTime();
  return timeSinceLastSeen < timeoutMs;
}

/**
 * Check if an agent is available for task assignment
 */
export function isAgentAvailable(agent: Agent): boolean {
  return (
    agent.status === AgentStatus.CONNECTED &&
    (agent.currentTask === null || agent.currentTask === undefined)
  );
}

/**
 * Get agent display name
 */
export function getAgentDisplayName(agent: Agent): string {
  return `${agent.role} (${agent.platform}/${agent.environment})`;
}

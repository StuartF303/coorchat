/**
 * Capability - Agent capability registration and discovery
 * Based on specs/001-multi-agent-coordination/contracts/capability-schema.json
 */

/**
 * Resource limits for agent capabilities
 */
export interface ResourceLimits {
  /** Maximum API calls per hour */
  apiQuotaPerHour?: number;

  /** Maximum number of simultaneous tasks (1-10) */
  maxConcurrentTasks?: number;

  /** Maximum requests per minute */
  rateLimitPerMinute?: number;

  /** Memory constraint in megabytes */
  memoryLimitMB?: number;
}

/**
 * Operating system platform
 */
export type Platform = 'Linux' | 'macOS' | 'Windows';

/**
 * Agent capability registration
 */
export interface Capability {
  /** Unique identifier for the agent */
  agentId: string;

  /** Agent role (extensible: developer, tester, architect, or custom) */
  roleType: string;

  /** Operating system platform */
  platform: Platform;

  /** Execution environment */
  environmentType?: string;

  /** Available commands, CLIs, or APIs the agent can use */
  tools: string[];

  /** Programming languages the agent can work with */
  languages?: string[];

  /** External APIs the agent has access to */
  apiAccess?: string[];

  /** Resource constraints and quotas for the agent */
  resourceLimits?: ResourceLimits;

  /** Custom capability metadata for specialized agent types */
  customMetadata?: Record<string, unknown>;
}

/**
 * Capability query filter
 */
export interface CapabilityQuery {
  /** Filter by role type */
  roleType?: string;

  /** Filter by platform */
  platform?: Platform;

  /** Filter by environment type */
  environmentType?: string;

  /** Filter by required tools (must have all) */
  requiredTools?: string[];

  /** Filter by required languages (must have all) */
  requiredLanguages?: string[];

  /** Filter by required API access (must have all) */
  requiredApiAccess?: string[];

  /** Filter by minimum resource limits */
  minResourceLimits?: Partial<ResourceLimits>;
}

/**
 * Validate capability object
 */
export function validateCapability(capability: unknown): capability is Capability {
  if (typeof capability !== 'object' || capability === null) {
    return false;
  }

  const cap = capability as Partial<Capability>;

  return (
    typeof cap.agentId === 'string' &&
    typeof cap.roleType === 'string' &&
    cap.roleType.length > 0 &&
    cap.roleType.length <= 50 &&
    typeof cap.platform === 'string' &&
    ['Linux', 'macOS', 'Windows'].includes(cap.platform) &&
    Array.isArray(cap.tools) &&
    cap.tools.length > 0 &&
    cap.tools.every((tool) => typeof tool === 'string')
  );
}

/**
 * Check if a capability matches a query
 */
export function matchesQuery(
  capability: Capability,
  query: CapabilityQuery
): boolean {
  // Check role type
  if (query.roleType && capability.roleType !== query.roleType) {
    return false;
  }

  // Check platform
  if (query.platform && capability.platform !== query.platform) {
    return false;
  }

  // Check environment type
  if (
    query.environmentType &&
    capability.environmentType !== query.environmentType
  ) {
    return false;
  }

  // Check required tools
  if (query.requiredTools) {
    const hasAllTools = query.requiredTools.every((tool) =>
      capability.tools.includes(tool)
    );
    if (!hasAllTools) {
      return false;
    }
  }

  // Check required languages
  if (query.requiredLanguages && capability.languages) {
    const hasAllLanguages = query.requiredLanguages.every((lang) =>
      capability.languages!.includes(lang)
    );
    if (!hasAllLanguages) {
      return false;
    }
  }

  // Check required API access
  if (query.requiredApiAccess && capability.apiAccess) {
    const hasAllApis = query.requiredApiAccess.every((api) =>
      capability.apiAccess!.includes(api)
    );
    if (!hasAllApis) {
      return false;
    }
  }

  // Check minimum resource limits
  if (query.minResourceLimits && capability.resourceLimits) {
    if (
      query.minResourceLimits.apiQuotaPerHour &&
      (capability.resourceLimits.apiQuotaPerHour || 0) <
        query.minResourceLimits.apiQuotaPerHour
    ) {
      return false;
    }

    if (
      query.minResourceLimits.maxConcurrentTasks &&
      (capability.resourceLimits.maxConcurrentTasks || 1) <
        query.minResourceLimits.maxConcurrentTasks
    ) {
      return false;
    }

    if (
      query.minResourceLimits.rateLimitPerMinute &&
      (capability.resourceLimits.rateLimitPerMinute || 0) <
        query.minResourceLimits.rateLimitPerMinute
    ) {
      return false;
    }

    if (
      query.minResourceLimits.memoryLimitMB &&
      (capability.resourceLimits.memoryLimitMB || 0) <
        query.minResourceLimits.memoryLimitMB
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Create a default capability object
 */
export function createDefaultCapability(
  agentId: string,
  roleType: string,
  platform: Platform,
  tools: string[]
): Capability {
  return {
    agentId,
    roleType,
    platform,
    tools,
    resourceLimits: {
      maxConcurrentTasks: 1,
    },
  };
}

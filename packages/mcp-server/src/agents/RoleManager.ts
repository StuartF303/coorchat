/**
 * RoleManager - Extensible role definitions and validation for custom roles
 * Manages predefined and custom agent role types
 */

import type { Logger } from '../logging/Logger.js';
import { createLogger } from '../logging/Logger.js';

/**
 * Role definition
 */
export interface RoleDefinition {
  /** Role name (unique identifier) */
  name: string;

  /** Human-readable description */
  description: string;

  /** Predefined or custom */
  type: 'predefined' | 'custom';

  /** Suggested capabilities */
  suggestedCapabilities?: {
    tools?: string[];
    languages?: string[];
    apiAccess?: string[];
  };

  /** Metadata */
  metadata?: Record<string, unknown>;

  /** When role was registered */
  registeredAt: Date;
}

/**
 * Role validation result
 */
export interface RoleValidation {
  valid: boolean;
  errors?: string[];
}

/**
 * Role manager configuration
 */
export interface RoleManagerConfig {
  /** Logger */
  logger?: Logger;

  /** Whether to allow custom roles */
  allowCustomRoles?: boolean;

  /** Maximum role name length */
  maxRoleNameLength?: number;
}

/**
 * RoleManager class
 */
export class RoleManager {
  private roles: Map<string, RoleDefinition>;
  private logger: Logger;
  private allowCustomRoles: boolean;
  private maxRoleNameLength: number;

  constructor(config: RoleManagerConfig = {}) {
    this.roles = new Map();
    this.logger = config.logger || createLogger();
    this.allowCustomRoles = config.allowCustomRoles ?? true;
    this.maxRoleNameLength = config.maxRoleNameLength || 50;

    // Register predefined roles
    this.registerPredefinedRoles();
  }

  /**
   * Register predefined roles
   */
  private registerPredefinedRoles(): void {
    const predefinedRoles: Omit<RoleDefinition, 'registeredAt'>[] = [
      {
        name: 'developer',
        description: 'Software developer - writes code, implements features',
        type: 'predefined',
        suggestedCapabilities: {
          tools: ['git', 'npm', 'docker'],
          languages: ['TypeScript', 'JavaScript', 'Python'],
        },
      },
      {
        name: 'tester',
        description: 'Quality assurance tester - writes and runs tests',
        type: 'predefined',
        suggestedCapabilities: {
          tools: ['jest', 'pytest', 'selenium', 'playwright'],
          languages: ['TypeScript', 'JavaScript', 'Python'],
        },
      },
      {
        name: 'architect',
        description: 'Software architect - designs system architecture',
        type: 'predefined',
        suggestedCapabilities: {
          tools: ['draw.io', 'plantuml'],
        },
      },
      {
        name: 'frontend',
        description: 'Frontend developer - UI/UX implementation',
        type: 'predefined',
        suggestedCapabilities: {
          tools: ['npm', 'webpack', 'vite'],
          languages: ['TypeScript', 'JavaScript', 'HTML', 'CSS'],
        },
      },
      {
        name: 'backend',
        description: 'Backend developer - server-side implementation',
        type: 'predefined',
        suggestedCapabilities: {
          tools: ['npm', 'docker', 'database-cli'],
          languages: ['TypeScript', 'JavaScript', 'Python', 'Go'],
        },
      },
      {
        name: 'infrastructure',
        description: 'Infrastructure engineer - DevOps, deployment, monitoring',
        type: 'predefined',
        suggestedCapabilities: {
          tools: ['docker', 'kubernetes', 'terraform', 'aws-cli', 'gcloud'],
        },
      },
      {
        name: 'security-auditor',
        description: 'Security auditor - security analysis and vulnerability testing',
        type: 'predefined',
        suggestedCapabilities: {
          tools: ['nmap', 'burp-suite', 'owasp-zap'],
        },
      },
      {
        name: 'documentation-writer',
        description: 'Technical writer - creates and maintains documentation',
        type: 'predefined',
        suggestedCapabilities: {
          tools: ['markdown', 'docusaurus', 'sphinx'],
        },
      },
    ];

    for (const role of predefinedRoles) {
      this.roles.set(role.name, {
        ...role,
        registeredAt: new Date(),
      });
    }

    this.logger.info('Predefined roles registered', {
      count: predefinedRoles.length,
    });
  }

  /**
   * Register a custom role
   */
  registerCustomRole(
    name: string,
    description: string,
    suggestedCapabilities?: RoleDefinition['suggestedCapabilities'],
    metadata?: Record<string, unknown>
  ): RoleDefinition {
    // Validate role name
    const validation = this.validateRoleName(name);
    if (!validation.valid) {
      throw new Error(`Invalid role name: ${validation.errors?.join(', ')}`);
    }

    // Check if custom roles are allowed
    if (!this.allowCustomRoles) {
      throw new Error('Custom roles are not allowed');
    }

    // Check if role already exists
    if (this.roles.has(name)) {
      throw new Error(`Role already exists: ${name}`);
    }

    const role: RoleDefinition = {
      name,
      description,
      type: 'custom',
      suggestedCapabilities,
      metadata,
      registeredAt: new Date(),
    };

    this.roles.set(name, role);

    this.logger.info('Custom role registered', { name, description });

    return role;
  }

  /**
   * Get role definition
   */
  getRole(name: string): RoleDefinition | undefined {
    return this.roles.get(name);
  }

  /**
   * Check if role exists
   */
  hasRole(name: string): boolean {
    return this.roles.has(name);
  }

  /**
   * Get all roles
   */
  getAllRoles(): RoleDefinition[] {
    return Array.from(this.roles.values());
  }

  /**
   * Get predefined roles
   */
  getPredefinedRoles(): RoleDefinition[] {
    return Array.from(this.roles.values()).filter(
      (role) => role.type === 'predefined'
    );
  }

  /**
   * Get custom roles
   */
  getCustomRoles(): RoleDefinition[] {
    return Array.from(this.roles.values()).filter(
      (role) => role.type === 'custom'
    );
  }

  /**
   * Validate role name
   */
  validateRoleName(name: string): RoleValidation {
    const errors: string[] = [];

    if (!name || name.trim().length === 0) {
      errors.push('Role name cannot be empty');
    }

    if (name.length > this.maxRoleNameLength) {
      errors.push(`Role name too long (max: ${this.maxRoleNameLength})`);
    }

    if (!/^[a-z0-9-]+$/.test(name)) {
      errors.push('Role name must contain only lowercase letters, numbers, and hyphens');
    }

    if (name.startsWith('-') || name.endsWith('-')) {
      errors.push('Role name cannot start or end with a hyphen');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate role (check if it exists or can be created)
   */
  validateRole(name: string): RoleValidation {
    // Check if role exists
    if (this.hasRole(name)) {
      return { valid: true };
    }

    // Check if role name is valid for custom roles
    if (!this.allowCustomRoles) {
      return {
        valid: false,
        errors: ['Custom roles are not allowed, and role is not predefined'],
      };
    }

    return this.validateRoleName(name);
  }

  /**
   * Remove custom role
   */
  removeCustomRole(name: string): boolean {
    const role = this.roles.get(name);
    if (!role) {
      return false;
    }

    if (role.type === 'predefined') {
      throw new Error('Cannot remove predefined role');
    }

    this.roles.delete(name);
    this.logger.info('Custom role removed', { name });
    return true;
  }

  /**
   * Update role description
   */
  updateRole(
    name: string,
    updates: {
      description?: string;
      suggestedCapabilities?: RoleDefinition['suggestedCapabilities'];
      metadata?: Record<string, unknown>;
    }
  ): RoleDefinition | undefined {
    const role = this.roles.get(name);
    if (!role) {
      return undefined;
    }

    if (role.type === 'predefined') {
      throw new Error('Cannot update predefined role');
    }

    const updatedRole: RoleDefinition = {
      ...role,
      ...(updates.description && { description: updates.description }),
      ...(updates.suggestedCapabilities && {
        suggestedCapabilities: updates.suggestedCapabilities,
      }),
      ...(updates.metadata && { metadata: updates.metadata }),
    };

    this.roles.set(name, updatedRole);
    this.logger.info('Role updated', { name });

    return updatedRole;
  }

  /**
   * Get role suggestions based on capabilities
   */
  suggestRoles(capabilities: {
    tools?: string[];
    languages?: string[];
  }): RoleDefinition[] {
    const suggestions: Array<{ role: RoleDefinition; score: number }> = [];

    for (const role of this.roles.values()) {
      if (!role.suggestedCapabilities) {
        continue;
      }

      let score = 0;

      // Match tools
      if (capabilities.tools && role.suggestedCapabilities.tools) {
        const matchingTools = capabilities.tools.filter((tool) =>
          role.suggestedCapabilities.tools?.includes(tool)
        );
        score += matchingTools.length;
      }

      // Match languages
      if (capabilities.languages && role.suggestedCapabilities.languages) {
        const matchingLanguages = capabilities.languages.filter((lang) =>
          role.suggestedCapabilities.languages?.includes(lang)
        );
        score += matchingLanguages.length;
      }

      if (score > 0) {
        suggestions.push({ role, score });
      }
    }

    // Sort by score (highest first)
    suggestions.sort((a, b) => b.score - a.score);

    return suggestions.map((s) => s.role);
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    predefined: number;
    custom: number;
  } {
    const all = this.getAllRoles();
    const predefined = this.getPredefinedRoles();
    const custom = this.getCustomRoles();

    return {
      total: all.length,
      predefined: predefined.length,
      custom: custom.length,
    };
  }
}

/**
 * Singleton role manager instance
 */
export const roleManager = new RoleManager();

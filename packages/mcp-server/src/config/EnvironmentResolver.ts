/**
 * EnvironmentResolver - Resolve environment variable placeholders in configuration
 * Supports ${VAR_NAME}, ${VAR_NAME:-default}, and ${VAR_NAME:?error message} syntax
 */

/**
 * Environment variable placeholder patterns
 */
const ENV_VAR_PATTERN = /\$\{([^}:]+)(?:([:-])([^}]+))?\}/g;

/**
 * Resolution options
 */
export interface ResolverOptions {
  /** Whether to throw on undefined variables */
  throwOnUndefined?: boolean;

  /** Custom environment variables (overrides process.env) */
  env?: Record<string, string | undefined>;

  /** Whether to resolve recursively */
  recursive?: boolean;

  /** Maximum recursion depth (prevents infinite loops) */
  maxDepth?: number;
}

/**
 * EnvironmentResolver class for resolving environment variable placeholders
 */
export class EnvironmentResolver {
  private options: Required<ResolverOptions>;

  constructor(options: ResolverOptions = {}) {
    this.options = {
      throwOnUndefined: false,
      env: process.env,
      recursive: true,
      maxDepth: 10,
      ...options,
    };
  }

  /**
   * Resolve environment variables in a string
   * Supported syntax:
   * - ${VAR_NAME} - Simple substitution
   * - ${VAR_NAME:-default} - Use default if undefined
   * - ${VAR_NAME:?error message} - Throw error if undefined
   *
   * @param input - String containing environment variable placeholders
   * @param depth - Current recursion depth (internal)
   * @returns Resolved string
   */
  resolve(input: string, depth: number = 0): string {
    if (depth >= this.options.maxDepth) {
      throw new Error(
        `Maximum recursion depth (${this.options.maxDepth}) exceeded while resolving environment variables`
      );
    }

    let hasUnresolved = false;

    const resolved = input.replace(
      ENV_VAR_PATTERN,
      (match, varName, operator, operand) => {
        const value = this.options.env[varName.trim()];

        // Handle :- operator (default value)
        if (operator === '-') {
          return value !== undefined ? value : operand || '';
        }

        // Handle :? operator (required with error message)
        if (operator === '?') {
          if (value === undefined) {
            throw new Error(operand || `Required environment variable not set: ${varName}`);
          }
          return value;
        }

        // Simple ${VAR_NAME} substitution
        if (value === undefined) {
          if (this.options.throwOnUndefined) {
            throw new Error(`Undefined environment variable: ${varName}`);
          }
          hasUnresolved = true;
          return match; // Keep placeholder if undefined
        }

        return value;
      }
    );

    // Recursively resolve if needed and if there were changes
    if (this.options.recursive && resolved !== input && hasUnresolved) {
      return this.resolve(resolved, depth + 1);
    }

    return resolved;
  }

  /**
   * Resolve environment variables in an object (deep)
   * @param obj - Object containing values with environment variable placeholders
   * @returns Object with resolved values
   */
  resolveObject<T>(obj: T): T {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.resolveObject(item)) as T;
    }

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.resolve(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.resolveObject(value);
      } else {
        result[key] = value;
      }
    }

    return result as T;
  }

  /**
   * Check if a string contains environment variable placeholders
   */
  hasPlaceholders(input: string): boolean {
    return ENV_VAR_PATTERN.test(input);
  }

  /**
   * Extract all environment variable names from a string
   */
  extractVariables(input: string): string[] {
    const variables: string[] = [];
    const regex = new RegExp(ENV_VAR_PATTERN.source, 'g');
    let match;

    while ((match = regex.exec(input)) !== null) {
      variables.push(match[1].trim());
    }

    return variables;
  }

  /**
   * Validate that all required environment variables are set
   * @param input - String or object to check
   * @returns Array of missing variable names
   */
  findMissingVariables(input: string | Record<string, unknown>): string[] {
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
    const variables = this.extractVariables(inputStr);
    const missing: string[] = [];

    for (const varName of variables) {
      if (this.options.env[varName] === undefined) {
        missing.push(varName);
      }
    }

    return [...new Set(missing)]; // Remove duplicates
  }

  /**
   * Get current environment (or custom env if provided)
   */
  getEnv(): Record<string, string | undefined> {
    return this.options.env;
  }

  /**
   * Update resolver options
   */
  setOptions(options: Partial<ResolverOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Singleton resolver instance
 */
export const resolver = new EnvironmentResolver();

/**
 * Convenience function to resolve environment variables in a string
 */
export function resolveEnv(input: string, options?: ResolverOptions): string {
  if (options) {
    return new EnvironmentResolver(options).resolve(input);
  }
  return resolver.resolve(input);
}

/**
 * Convenience function to resolve environment variables in an object
 */
export function resolveEnvObject<T>(obj: T, options?: ResolverOptions): T {
  if (options) {
    return new EnvironmentResolver(options).resolveObject(obj);
  }
  return resolver.resolveObject(obj);
}

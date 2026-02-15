/**
 * ConfigLoader - Load configuration from JSON/YAML files with environment variable substitution
 */

import { readFileSync, existsSync } from 'fs';
import { parse as parseYAML } from 'yaml';
import { EnvironmentResolver } from './EnvironmentResolver.js';

/**
 * Configuration file format
 */
export type ConfigFormat = 'json' | 'yaml' | 'yml';

/**
 * Load options
 */
export interface LoadOptions {
  /** Whether to resolve environment variables */
  resolveEnv?: boolean;

  /** Whether to throw on missing file */
  throwOnMissing?: boolean;

  /** Default config to merge with loaded config */
  defaults?: Record<string, unknown>;

  /** Encoding for reading files */
  encoding?: BufferEncoding;
}

/**
 * ConfigLoader class for loading configuration files
 */
export class ConfigLoader {
  private resolver: EnvironmentResolver;

  constructor() {
    this.resolver = new EnvironmentResolver();
  }

  /**
   * Load configuration from a file
   * @param filePath - Path to configuration file
   * @param options - Load options
   * @returns Parsed configuration object
   */
  load<T = Record<string, unknown>>(
    filePath: string,
    options: LoadOptions = {}
  ): T {
    const {
      resolveEnv = true,
      throwOnMissing = true,
      defaults = {},
      encoding = 'utf-8',
    } = options;

    // Check if file exists
    if (!existsSync(filePath)) {
      if (throwOnMissing) {
        throw new Error(`Configuration file not found: ${filePath}`);
      }
      return defaults as T;
    }

    // Read file content
    let content: string;
    try {
      content = readFileSync(filePath, encoding);
    } catch (error) {
      throw new Error(
        `Failed to read configuration file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // Resolve environment variables if requested
    if (resolveEnv) {
      content = this.resolver.resolve(content);
    }

    // Determine format from file extension
    const format = this.detectFormat(filePath);

    // Parse content based on format
    let config: Record<string, unknown>;
    try {
      config = this.parse(content, format);
    } catch (error) {
      throw new Error(
        `Failed to parse configuration file (${format}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // Merge with defaults
    return this.mergeDeep(defaults, config) as T;
  }

  /**
   * Load configuration from multiple files (cascade)
   * Later files override earlier files
   */
  loadMultiple<T = Record<string, unknown>>(
    filePaths: string[],
    options: LoadOptions = {}
  ): T {
    let merged: Record<string, unknown> = options.defaults || {};

    for (const filePath of filePaths) {
      try {
        const config = this.load(filePath, {
          ...options,
          throwOnMissing: false,
          defaults: {},
        });
        merged = this.mergeDeep(merged, config);
      } catch (error) {
        if (options.throwOnMissing) {
          throw error;
        }
        // Skip files that can't be loaded if throwOnMissing is false
      }
    }

    return merged as T;
  }

  /**
   * Detect configuration format from file extension
   */
  private detectFormat(filePath: string): ConfigFormat {
    const ext = filePath.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'json':
        return 'json';
      case 'yaml':
      case 'yml':
        return 'yaml';
      default:
        throw new Error(
          `Unknown configuration file format: ${ext}. Supported formats: json, yaml, yml`
        );
    }
  }

  /**
   * Parse configuration content based on format
   */
  private parse(content: string, format: ConfigFormat): Record<string, unknown> {
    switch (format) {
      case 'json':
        return JSON.parse(content);

      case 'yaml':
      case 'yml':
        return parseYAML(content) as Record<string, unknown>;

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Deep merge two objects
   * Later object properties override earlier object properties
   */
  private mergeDeep(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (
          this.isPlainObject(sourceValue) &&
          this.isPlainObject(targetValue)
        ) {
          result[key] = this.mergeDeep(
            targetValue as Record<string, unknown>,
            sourceValue as Record<string, unknown>
          );
        } else {
          result[key] = sourceValue;
        }
      }
    }

    return result;
  }

  /**
   * Check if a value is a plain object
   */
  private isPlainObject(value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }

  /**
   * Get environment resolver instance
   */
  getResolver(): EnvironmentResolver {
    return this.resolver;
  }
}

/**
 * Singleton config loader instance
 */
export const configLoader = new ConfigLoader();

/**
 * Convenience function to load configuration
 */
export function loadConfig<T = Record<string, unknown>>(
  filePath: string,
  options?: LoadOptions
): T {
  return configLoader.load<T>(filePath, options);
}

/**
 * Convenience function to load multiple configuration files
 */
export function loadMultipleConfigs<T = Record<string, unknown>>(
  filePaths: string[],
  options?: LoadOptions
): T {
  return configLoader.loadMultiple<T>(filePaths, options);
}

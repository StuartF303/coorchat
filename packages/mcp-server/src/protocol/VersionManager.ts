/**
 * VersionManager - Protocol versioning and backward compatibility
 *
 * Supports backward compatibility for 1 major version:
 * - Version 1.x can communicate with version 1.y
 * - Version 2.x can communicate with version 1.y (with feature degradation)
 * - Version 3.x cannot communicate with version 1.y
 */

import { Message } from './Message.js';

/**
 * Protocol version structure
 */
export interface ProtocolVersion {
  major: number;
  minor: number;
}

/**
 * Version compatibility result
 */
export interface CompatibilityResult {
  compatible: boolean;
  requiresDowngrade: boolean;
  targetVersion?: string;
  reason?: string;
}

/**
 * Version feature support
 */
export interface VersionFeatures {
  version: string;
  supportedMessageTypes: string[];
  requiredFields: string[];
  optionalFields: string[];
  deprecatedFields: string[];
}

/**
 * VersionManager class for protocol versioning
 */
export class VersionManager {
  /**
   * Current protocol version
   */
  public static readonly CURRENT_VERSION = '1.0';

  /**
   * Minimum supported version (backward compatibility limit)
   */
  public static readonly MIN_SUPPORTED_VERSION = '1.0';

  /**
   * Maximum major version difference for compatibility
   */
  public static readonly MAX_MAJOR_VERSION_DIFF = 1;

  /**
   * Version feature matrix
   */
  private static readonly VERSION_FEATURES: Map<string, VersionFeatures> = new Map([
    [
      '1.0',
      {
        version: '1.0',
        supportedMessageTypes: [
          'task_assigned',
          'task_started',
          'task_blocked',
          'task_progress',
          'task_completed',
          'task_failed',
          'capability_query',
          'capability_response',
          'status_query',
          'status_response',
          'error',
          'heartbeat',
          'agent_joined',
          'agent_left',
        ],
        requiredFields: ['protocolVersion', 'messageType', 'senderId', 'timestamp'],
        optionalFields: [
          'recipientId',
          'taskId',
          'priority',
          'correlationId',
          'payload',
          'deliveryStatus',
        ],
        deprecatedFields: [],
      },
    ],
  ]);

  /**
   * Parse version string to components
   */
  static parseVersion(version: string): ProtocolVersion {
    const match = version.match(/^(\d+)\.(\d+)$/);
    if (!match) {
      throw new Error(`Invalid version format: ${version}`);
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
    };
  }

  /**
   * Format version components to string
   */
  static formatVersion(version: ProtocolVersion): string {
    return `${version.major}.${version.minor}`;
  }

  /**
   * Compare two versions
   * @returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
   */
  static compareVersions(v1: string, v2: string): number {
    const ver1 = this.parseVersion(v1);
    const ver2 = this.parseVersion(v2);

    if (ver1.major !== ver2.major) {
      return ver1.major < ver2.major ? -1 : 1;
    }

    if (ver1.minor !== ver2.minor) {
      return ver1.minor < ver2.minor ? -1 : 1;
    }

    return 0;
  }

  /**
   * Check if two versions are compatible
   */
  static areVersionsCompatible(
    localVersion: string,
    remoteVersion: string
  ): CompatibilityResult {
    const local = this.parseVersion(localVersion);
    const remote = this.parseVersion(remoteVersion);

    // Same version - fully compatible
    if (local.major === remote.major && local.minor === remote.minor) {
      return { compatible: true, requiresDowngrade: false };
    }

    // Same major version - compatible (minor version differences allowed)
    if (local.major === remote.major) {
      return {
        compatible: true,
        requiresDowngrade: local.minor > remote.minor,
        targetVersion: remote.minor < local.minor ? remoteVersion : undefined,
      };
    }

    // Different major versions - check if within compatibility window
    const majorDiff = Math.abs(local.major - remote.major);
    if (majorDiff <= this.MAX_MAJOR_VERSION_DIFF) {
      // Backward compatibility: newer version can downgrade to older
      if (local.major > remote.major) {
        return {
          compatible: true,
          requiresDowngrade: true,
          targetVersion: remoteVersion,
          reason: `Downgrading from ${localVersion} to ${remoteVersion} for compatibility`,
        };
      }

      // Forward compatibility: older version can receive newer messages
      // (with potential field degradation)
      return {
        compatible: true,
        requiresDowngrade: false,
        reason: `Receiving messages from newer version ${remoteVersion}, some features may be unavailable`,
      };
    }

    // Too many major versions apart - incompatible
    return {
      compatible: false,
      requiresDowngrade: false,
      reason: `Version ${localVersion} is incompatible with ${remoteVersion} (major version difference: ${majorDiff})`,
    };
  }

  /**
   * Get features supported by a version
   */
  static getVersionFeatures(version: string): VersionFeatures | undefined {
    return this.VERSION_FEATURES.get(version);
  }

  /**
   * Check if a message type is supported in a version
   */
  static isMessageTypeSupported(version: string, messageType: string): boolean {
    const features = this.getVersionFeatures(version);
    return features?.supportedMessageTypes.includes(messageType) ?? false;
  }

  /**
   * Downgrade message to target version
   * Removes fields not supported in target version
   */
  static downgradeMessage(message: Message, targetVersion: string): Message {
    const targetFeatures = this.getVersionFeatures(targetVersion);
    if (!targetFeatures) {
      throw new Error(`Unknown target version: ${targetVersion}`);
    }

    // Create a copy of the message
    const downgraded = { ...message };

    // Update protocol version
    downgraded.protocolVersion = targetVersion;

    // Remove deprecated fields
    for (const field of targetFeatures.deprecatedFields) {
      delete (downgraded as Record<string, unknown>)[field];
    }

    // Check if message type is supported
    if (!targetFeatures.supportedMessageTypes.includes(message.messageType)) {
      throw new Error(
        `Message type ${message.messageType} is not supported in version ${targetVersion}`
      );
    }

    return downgraded;
  }

  /**
   * Upgrade message from older version
   * Adds default values for new fields
   */
  static upgradeMessage(message: Message, targetVersion: string): Message {
    const targetFeatures = this.getVersionFeatures(targetVersion);
    if (!targetFeatures) {
      throw new Error(`Unknown target version: ${targetVersion}`);
    }

    // Create a copy of the message
    const upgraded = { ...message };

    // Update protocol version
    upgraded.protocolVersion = targetVersion;

    // Add default values for new optional fields if missing
    // (In v1.0, all fields are already defined, so this is a placeholder for future versions)

    return upgraded;
  }

  /**
   * Negotiate protocol version between two agents
   * Returns the highest mutually compatible version
   */
  static negotiateVersion(localVersion: string, remoteVersion: string): string | null {
    const compatibility = this.areVersionsCompatible(localVersion, remoteVersion);

    if (!compatibility.compatible) {
      return null;
    }

    // Use the lower version for communication
    return this.compareVersions(localVersion, remoteVersion) <= 0
      ? localVersion
      : remoteVersion;
  }

  /**
   * Validate version string format
   */
  static isValidVersion(version: string): boolean {
    try {
      this.parseVersion(version);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get version info
   */
  static getVersionInfo(): {
    current: string;
    minSupported: string;
    maxMajorDiff: number;
  } {
    return {
      current: this.CURRENT_VERSION,
      minSupported: this.MIN_SUPPORTED_VERSION,
      maxMajorDiff: this.MAX_MAJOR_VERSION_DIFF,
    };
  }
}

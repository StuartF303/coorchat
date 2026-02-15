/**
 * CoorChat Message Protocol - TypeScript Type Definitions
 * Based on message-protocol.json schema v1.0
 */

/**
 * Message types for agent coordination
 */
export enum MessageType {
  TASK_ASSIGNED = 'task_assigned',
  TASK_STARTED = 'task_started',
  TASK_BLOCKED = 'task_blocked',
  TASK_PROGRESS = 'task_progress',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  CAPABILITY_QUERY = 'capability_query',
  CAPABILITY_RESPONSE = 'capability_response',
  STATUS_QUERY = 'status_query',
  STATUS_RESPONSE = 'status_response',
  DIRECT_MESSAGE = 'direct_message',
  BROADCAST = 'broadcast',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
  AGENT_JOINED = 'agent_joined',
  AGENT_LEFT = 'agent_left',
}

/**
 * Delivery status states
 */
export enum DeliveryStatus {
  QUEUED = 'queued',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  ACKNOWLEDGED = 'acknowledged',
  FAILED = 'failed',
}

/**
 * Resource limits for agent capabilities
 */
export interface ResourceLimits {
  apiQuotaPerHour?: number;
  maxConcurrentTasks?: number;
  rateLimitPerMinute?: number;
  memoryLimitMB?: number;
}

/**
 * Payload for task_assigned messages
 */
export interface TaskAssignedPayload {
  taskId: string;
  description: string;
  dependencies?: string[];
  githubIssue: string;
}

/**
 * Payload for task_progress messages
 */
export interface TaskProgressPayload {
  taskId: string;
  percentComplete: number;
  status: string;
}

/**
 * Payload for task_completed messages
 */
export interface TaskCompletedPayload {
  taskId: string;
  result: Record<string, unknown>;
  githubPR?: string | null;
}

/**
 * Payload for task_failed messages
 */
export interface TaskFailedPayload {
  taskId: string;
  error: string;
  retryable: boolean;
  stackTrace?: string | null;
}

/**
 * Payload for capability_response messages
 */
export interface CapabilityResponsePayload {
  agentId: string;
  roleType: string;
  platform: string;
  environmentType?: string;
  tools: string[];
  languages?: string[];
  apiAccess?: string[];
  resourceLimits?: ResourceLimits;
}

/**
 * Payload for direct_message messages
 */
export interface DirectMessagePayload {
  text: string;
  userId: string;
  expectsResponse?: boolean;
  timeoutMs?: number;
}

/**
 * Payload for broadcast messages
 */
export interface BroadcastPayload {
  text: string;
  userId: string;
}

/**
 * Payload for error messages
 */
export interface ErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

/**
 * Union type of all possible payloads
 */
export type MessagePayload =
  | TaskAssignedPayload
  | TaskProgressPayload
  | TaskCompletedPayload
  | TaskFailedPayload
  | CapabilityResponsePayload
  | DirectMessagePayload
  | BroadcastPayload
  | ErrorPayload
  | Record<string, unknown>;

/**
 * Core message structure for all agent communications
 */
export interface Message {
  /** Semantic version of the protocol (e.g., '1.0') */
  protocolVersion: string;

  /** Type of message being sent */
  messageType: MessageType;

  /** UUID of the sending agent */
  senderId: string;

  /** UUID of the recipient agent (null for broadcast) */
  recipientId?: string | null;

  /** UUID of the associated task (if applicable) */
  taskId?: string | null;

  /** Message priority (0=lowest, 10=highest) */
  priority?: number;

  /** ISO 8601 timestamp when message was created */
  timestamp: string;

  /** UUID for matching request/response pairs */
  correlationId?: string | null;

  /** Message-specific data (varies by messageType) */
  payload?: MessagePayload;

  /** Current delivery state of the message */
  deliveryStatus?: DeliveryStatus;
}

/**
 * Type guard to check if a value is a valid Message
 */
export function isMessage(value: unknown): value is Message {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const msg = value as Partial<Message>;

  return (
    typeof msg.protocolVersion === 'string' &&
    typeof msg.messageType === 'string' &&
    Object.values(MessageType).includes(msg.messageType as MessageType) &&
    typeof msg.senderId === 'string' &&
    typeof msg.timestamp === 'string'
  );
}

/**
 * Type guard to check if a message type is task-related
 */
export function isTaskMessage(messageType: MessageType): boolean {
  return [
    MessageType.TASK_ASSIGNED,
    MessageType.TASK_STARTED,
    MessageType.TASK_BLOCKED,
    MessageType.TASK_PROGRESS,
    MessageType.TASK_COMPLETED,
    MessageType.TASK_FAILED,
  ].includes(messageType);
}

/**
 * Type guard to check if a message type is capability-related
 */
export function isCapabilityMessage(messageType: MessageType): boolean {
  return [
    MessageType.CAPABILITY_QUERY,
    MessageType.CAPABILITY_RESPONSE,
  ].includes(messageType);
}

/**
 * Type guard to check if a message type is status-related
 */
export function isStatusMessage(messageType: MessageType): boolean {
  return [
    MessageType.STATUS_QUERY,
    MessageType.STATUS_RESPONSE,
  ].includes(messageType);
}

/**
 * MessageBuilder - Fluent API for constructing CoorChat messages
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Message,
  MessageType,
  DeliveryStatus,
  MessagePayload,
  TaskAssignedPayload,
  TaskProgressPayload,
  TaskCompletedPayload,
  TaskFailedPayload,
  CapabilityResponsePayload,
  ErrorPayload,
} from './Message.js';

/**
 * Default protocol version
 */
const DEFAULT_PROTOCOL_VERSION = '1.0';

/**
 * Default message priority
 */
const DEFAULT_PRIORITY = 5;

/**
 * Fluent builder for creating Message instances
 */
export class MessageBuilder {
  private message: Partial<Message>;

  constructor() {
    this.message = {
      protocolVersion: DEFAULT_PROTOCOL_VERSION,
      priority: DEFAULT_PRIORITY,
      timestamp: new Date().toISOString(),
      deliveryStatus: DeliveryStatus.QUEUED,
    };
  }

  /**
   * Set the message type
   */
  type(messageType: MessageType): this {
    this.message.messageType = messageType;
    return this;
  }

  /**
   * Set the sender ID
   */
  from(senderId: string): this {
    this.message.senderId = senderId;
    return this;
  }

  /**
   * Set the recipient ID (null or undefined for broadcast)
   */
  to(recipientId: string | null | undefined): this {
    this.message.recipientId = recipientId;
    return this;
  }

  /**
   * Set the task ID
   */
  forTask(taskId: string | null | undefined): this {
    this.message.taskId = taskId;
    return this;
  }

  /**
   * Set the message priority (0-10)
   */
  priority(priority: number): this {
    this.message.priority = Math.max(0, Math.min(10, priority));
    return this;
  }

  /**
   * Set the correlation ID for request/response matching
   */
  correlate(correlationId: string | null | undefined): this {
    this.message.correlationId = correlationId;
    return this;
  }

  /**
   * Set the protocol version
   */
  version(protocolVersion: string): this {
    this.message.protocolVersion = protocolVersion;
    return this;
  }

  /**
   * Set the message payload
   */
  payload(payload: MessagePayload): this {
    this.message.payload = payload;
    return this;
  }

  /**
   * Set the delivery status
   */
  status(deliveryStatus: DeliveryStatus): this {
    this.message.deliveryStatus = deliveryStatus;
    return this;
  }

  /**
   * Build and return the completed message
   * @throws Error if required fields are missing
   */
  build(): Message {
    if (!this.message.messageType) {
      throw new Error('Message type is required');
    }
    if (!this.message.senderId) {
      throw new Error('Sender ID is required');
    }

    return this.message as Message;
  }

  /**
   * Create a task_assigned message
   */
  static taskAssigned(
    senderId: string,
    recipientId: string,
    payload: TaskAssignedPayload
  ): Message {
    return new MessageBuilder()
      .type(MessageType.TASK_ASSIGNED)
      .from(senderId)
      .to(recipientId)
      .forTask(payload.taskId)
      .priority(7)
      .payload(payload)
      .build();
  }

  /**
   * Create a task_started message
   */
  static taskStarted(
    senderId: string,
    taskId: string,
    payload?: Record<string, unknown>
  ): Message {
    return new MessageBuilder()
      .type(MessageType.TASK_STARTED)
      .from(senderId)
      .forTask(taskId)
      .payload(payload || {})
      .build();
  }

  /**
   * Create a task_progress message
   */
  static taskProgress(
    senderId: string,
    payload: TaskProgressPayload
  ): Message {
    return new MessageBuilder()
      .type(MessageType.TASK_PROGRESS)
      .from(senderId)
      .forTask(payload.taskId)
      .payload(payload)
      .build();
  }

  /**
   * Create a task_completed message
   */
  static taskCompleted(
    senderId: string,
    payload: TaskCompletedPayload
  ): Message {
    return new MessageBuilder()
      .type(MessageType.TASK_COMPLETED)
      .from(senderId)
      .forTask(payload.taskId)
      .priority(8)
      .payload(payload)
      .build();
  }

  /**
   * Create a task_failed message
   */
  static taskFailed(
    senderId: string,
    payload: TaskFailedPayload
  ): Message {
    return new MessageBuilder()
      .type(MessageType.TASK_FAILED)
      .from(senderId)
      .forTask(payload.taskId)
      .priority(9)
      .payload(payload)
      .build();
  }

  /**
   * Create a task_blocked message
   */
  static taskBlocked(
    senderId: string,
    taskId: string,
    blockedBy: string[],
    reason: string
  ): Message {
    return new MessageBuilder()
      .type(MessageType.TASK_BLOCKED)
      .from(senderId)
      .forTask(taskId)
      .priority(7)
      .payload({ blockedBy, reason })
      .build();
  }

  /**
   * Create a capability_query message
   */
  static capabilityQuery(
    senderId: string,
    recipientId?: string | null,
    correlationId?: string
  ): Message {
    return new MessageBuilder()
      .type(MessageType.CAPABILITY_QUERY)
      .from(senderId)
      .to(recipientId)
      .correlate(correlationId || uuidv4())
      .payload({})
      .build();
  }

  /**
   * Create a capability_response message
   */
  static capabilityResponse(
    senderId: string,
    payload: CapabilityResponsePayload,
    correlationId: string
  ): Message {
    return new MessageBuilder()
      .type(MessageType.CAPABILITY_RESPONSE)
      .from(senderId)
      .correlate(correlationId)
      .payload(payload)
      .build();
  }

  /**
   * Create a status_query message
   */
  static statusQuery(
    senderId: string,
    recipientId?: string | null,
    correlationId?: string
  ): Message {
    return new MessageBuilder()
      .type(MessageType.STATUS_QUERY)
      .from(senderId)
      .to(recipientId)
      .correlate(correlationId || uuidv4())
      .payload({})
      .build();
  }

  /**
   * Create a status_response message
   */
  static statusResponse(
    senderId: string,
    status: Record<string, unknown>,
    correlationId: string
  ): Message {
    return new MessageBuilder()
      .type(MessageType.STATUS_RESPONSE)
      .from(senderId)
      .correlate(correlationId)
      .payload(status)
      .build();
  }

  /**
   * Create an error message
   */
  static error(
    senderId: string,
    payload: ErrorPayload,
    priority: number = 9
  ): Message {
    return new MessageBuilder()
      .type(MessageType.ERROR)
      .from(senderId)
      .priority(priority)
      .payload(payload)
      .build();
  }

  /**
   * Create a heartbeat message
   */
  static heartbeat(senderId: string): Message {
    return new MessageBuilder()
      .type(MessageType.HEARTBEAT)
      .from(senderId)
      .priority(1)
      .payload({ timestamp: new Date().toISOString() })
      .build();
  }

  /**
   * Create an agent_joined message
   */
  static agentJoined(
    senderId: string,
    agentInfo: Record<string, unknown>
  ): Message {
    return new MessageBuilder()
      .type(MessageType.AGENT_JOINED)
      .from(senderId)
      .priority(6)
      .payload(agentInfo)
      .build();
  }

  /**
   * Create an agent_left message
   */
  static agentLeft(
    senderId: string,
    reason?: string
  ): Message {
    return new MessageBuilder()
      .type(MessageType.AGENT_LEFT)
      .from(senderId)
      .priority(6)
      .payload({ reason: reason || 'Normal disconnect' })
      .build();
  }
}

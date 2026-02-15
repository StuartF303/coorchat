/**
 * Integration Test: Agent Task Coordination
 * Tests the complete workflow from GitHub issue → task assignment → agent coordination
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { Agent, AgentStatus, createAgent } from '../../src/agents/Agent.js';
import { Capability, Platform } from '../../src/agents/Capability.js';
import { AgentRegistry } from '../../src/agents/AgentRegistry.js';
import { RoleManager } from '../../src/agents/RoleManager.js';
import { Task, TaskStatus, createTask } from '../../src/tasks/Task.js';
import { TaskQueue } from '../../src/tasks/TaskQueue.js';
import { DependencyTracker } from '../../src/tasks/DependencyTracker.js';
import { MessageBuilder } from '../../src/protocol/MessageBuilder.js';
import { MessageType } from '../../src/protocol/Message.js';

describe('Agent Task Coordination', () => {
  let agentRegistry: AgentRegistry;
  let roleManager: RoleManager;
  let taskQueue: TaskQueue;
  let dependencyTracker: DependencyTracker;
  let developerAgent: Agent;
  let testerAgent: Agent;

  beforeEach(() => {
    // Initialize components
    agentRegistry = new AgentRegistry({ enableTimeoutChecking: false });
    roleManager = new RoleManager();
    taskQueue = new TaskQueue();
    dependencyTracker = new DependencyTracker();

    // Create test agents
    const developerCapability: Capability = {
      agentId: uuidv4(),
      roleType: 'developer',
      platform: 'Linux' as Platform,
      tools: ['git', 'npm', 'docker', 'typescript'],
      languages: ['TypeScript', 'JavaScript'],
    };

    const testerCapability: Capability = {
      agentId: uuidv4(),
      roleType: 'tester',
      platform: 'Linux' as Platform,
      tools: ['jest', 'playwright', 'docker'],
      languages: ['TypeScript', 'JavaScript'],
    };

    developerAgent = createAgent(developerCapability.agentId, {
      role: 'developer',
      platform: 'Linux' as Platform,
      environment: 'GitHub Actions',
      capabilities: developerCapability,
    });
    developerAgent.status = AgentStatus.CONNECTED;

    testerAgent = createAgent(testerCapability.agentId, {
      role: 'tester',
      platform: 'Linux' as Platform,
      environment: 'GitHub Actions',
      capabilities: testerCapability,
    });
    testerAgent.status = AgentStatus.CONNECTED;
  });

  afterEach(() => {
    agentRegistry.clear();
    taskQueue.clear();
    dependencyTracker.clear();
  });

  it('should register agents successfully', async () => {
    await agentRegistry.add(developerAgent);
    await agentRegistry.add(testerAgent);

    expect(agentRegistry.count()).toBe(2);
    expect(agentRegistry.getById(developerAgent.id)).toBeDefined();
    expect(agentRegistry.getById(testerAgent.id)).toBeDefined();
  });

  it('should assign task to available agent', async () => {
    await agentRegistry.add(developerAgent);

    // Create a task
    const task = createTask(uuidv4(), {
      description: 'Implement user authentication',
      githubIssueId: '42',
      githubIssueUrl: 'https://github.com/org/repo/issues/42',
    });

    // Add to queue
    taskQueue.enqueue(task);

    // Assign to developer agent
    const assignedTask = await taskQueue.assignNext(developerAgent);

    expect(assignedTask).toBeDefined();
    expect(assignedTask?.id).toBe(task.id);
    expect(assignedTask?.assignedAgents).toContain(developerAgent.id);
    expect(assignedTask?.status).toBe(TaskStatus.ASSIGNED);
  });

  it('should emit task lifecycle events', async () => {
    const lifecycleEvents: string[] = [];

    taskQueue.onLifecycle((event) => {
      lifecycleEvents.push(event.type);
    });

    await agentRegistry.add(developerAgent);

    const task = createTask(uuidv4(), {
      description: 'Fix authentication bug',
      githubIssueId: '43',
      githubIssueUrl: 'https://github.com/org/repo/issues/43',
    });

    taskQueue.enqueue(task);
    const assignedTask = await taskQueue.assignNext(developerAgent);

    expect(assignedTask).toBeDefined();

    // Simulate task lifecycle
    await taskQueue.markStarted(assignedTask!.id, developerAgent);
    await taskQueue.updateProgress(assignedTask!.id, developerAgent, 50, 'In progress');
    await taskQueue.markCompleted(assignedTask!.id, developerAgent, { success: true });

    expect(lifecycleEvents).toContain('task_started');
    expect(lifecycleEvents).toContain('task_progress');
    expect(lifecycleEvents).toContain('task_completed');
  });

  it('should handle task dependencies correctly', async () => {
    // Create task chain: task2 depends on task1
    const task1 = createTask(uuidv4(), {
      description: 'Task 1',
      githubIssueId: '1',
      githubIssueUrl: 'https://github.com/org/repo/issues/1',
    });

    const task2 = createTask(uuidv4(), {
      description: 'Task 2 (depends on Task 1)',
      dependencies: [task1.id],
      githubIssueId: '2',
      githubIssueUrl: 'https://github.com/org/repo/issues/2',
    });

    // Add to dependency tracker
    dependencyTracker.addTask(task1);
    dependencyTracker.addTask(task2);

    // Task 2 should be blocked initially
    expect(dependencyTracker.areDependenciesCompleted(task2.id)).toBe(false);
    expect(dependencyTracker.getBlockingDependencies(task2.id)).toContain(task1.id);

    // Complete task 1
    await dependencyTracker.updateTaskStatus(task1.id, TaskStatus.COMPLETED);

    // Task 2 should now be unblocked
    expect(dependencyTracker.areDependenciesCompleted(task2.id)).toBe(true);
    expect(dependencyTracker.getBlockingDependencies(task2.id)).toHaveLength(0);
  });

  it('should notify when dependencies are resolved', async () => {
    let unblockedTaskId: string | undefined;

    dependencyTracker.onDependencyResolved((event) => {
      unblockedTaskId = event.task.id;
    });

    const task1 = createTask(uuidv4(), {
      description: 'Task 1',
      githubIssueId: '1',
      githubIssueUrl: 'https://github.com/org/repo/issues/1',
    });

    const task2 = createTask(uuidv4(), {
      description: 'Task 2',
      dependencies: [task1.id],
      githubIssueId: '2',
      githubIssueUrl: 'https://github.com/org/repo/issues/2',
    });

    dependencyTracker.addTask(task1);
    dependencyTracker.addTask(task2);

    // Complete task 1
    await dependencyTracker.updateTaskStatus(task1.id, TaskStatus.COMPLETED);

    // Wait for async notification
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(unblockedTaskId).toBe(task2.id);
  });

  it('should build protocol messages correctly', () => {
    const taskId = uuidv4();
    const agentId = developerAgent.id;

    // Test task_assigned message
    const assignedMsg = MessageBuilder.taskAssigned(
      agentId,
      testerAgent.id,
      {
        taskId,
        description: 'Test task',
        githubIssue: 'https://github.com/org/repo/issues/1',
      }
    );

    expect(assignedMsg.messageType).toBe(MessageType.TASK_ASSIGNED);
    expect(assignedMsg.senderId).toBe(agentId);
    expect(assignedMsg.recipientId).toBe(testerAgent.id);
    expect(assignedMsg.taskId).toBe(taskId);
    expect(assignedMsg.payload).toBeDefined();

    // Test task_completed message
    const completedMsg = MessageBuilder.taskCompleted(agentId, {
      taskId,
      result: { success: true },
      githubPR: 'https://github.com/org/repo/pull/1',
    });

    expect(completedMsg.messageType).toBe(MessageType.TASK_COMPLETED);
    expect(completedMsg.senderId).toBe(agentId);
    expect(completedMsg.taskId).toBe(taskId);
  });

  it('should manage agent roles correctly', () => {
    // Predefined roles should exist
    expect(roleManager.hasRole('developer')).toBe(true);
    expect(roleManager.hasRole('tester')).toBe(true);
    expect(roleManager.hasRole('architect')).toBe(true);

    // Should be able to register custom role
    const customRole = roleManager.registerCustomRole(
      'ml-engineer',
      'Machine Learning Engineer',
      {
        tools: ['python', 'tensorflow', 'jupyter'],
        languages: ['Python'],
      }
    );

    expect(customRole.name).toBe('ml-engineer');
    expect(customRole.type).toBe('custom');
    expect(roleManager.hasRole('ml-engineer')).toBe(true);
  });

  it('should suggest roles based on capabilities', () => {
    const suggestions = roleManager.suggestRoles({
      tools: ['git', 'npm', 'docker'],
      languages: ['TypeScript', 'JavaScript'],
    });

    // Should suggest developer role (has matching tools/languages)
    const roleNames = suggestions.map((r) => r.name);
    expect(roleNames).toContain('developer');
  });

  it('should handle complete workflow: GitHub issue → task → agent → completion', async () => {
    // Step 1: Register agents
    await agentRegistry.add(developerAgent);
    await agentRegistry.add(testerAgent);

    // Step 2: Create task from GitHub issue
    const task = createTask(uuidv4(), {
      description: 'Implement user authentication feature',
      githubIssueId: '42',
      githubIssueUrl: 'https://github.com/org/repo/issues/42',
    });

    // Step 3: Add task to queue
    taskQueue.enqueue(task);

    // Step 4: Assign task to developer agent
    const assignedTask = await taskQueue.assignNext(developerAgent);
    expect(assignedTask).toBeDefined();

    // Step 5: Developer starts work
    await taskQueue.markStarted(assignedTask!.id, developerAgent);

    // Step 6: Developer reports progress
    await taskQueue.updateProgress(assignedTask!.id, developerAgent, 50, 'Implementing auth logic');

    // Step 7: Developer completes task
    await taskQueue.markCompleted(assignedTask!.id, developerAgent, {
      pullRequest: 'https://github.com/org/repo/pull/100',
    });

    // Verify task is no longer in assigned tasks
    expect(taskQueue.getTaskById(assignedTask!.id)).toBeUndefined();
  });

  it('should handle agent timeout detection', async () => {
    const registry = new AgentRegistry({
      enableTimeoutChecking: true,
      timeoutMs: 1000, // 1 second
    });

    let timedOutAgent: Agent | undefined;

    registry.onEvent((event) => {
      if (event.type === 'agent_timeout') {
        timedOutAgent = event.agent;
      }
    });

    await registry.add(developerAgent);

    // Wait for timeout
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(timedOutAgent).toBeDefined();
    expect(timedOutAgent?.id).toBe(developerAgent.id);

    registry.destroy();
  });
});

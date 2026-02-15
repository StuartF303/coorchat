/**
 * Task - Represents a work item from GitHub repository
 * Based on specs/001-multi-agent-coordination/data-model.md
 */

/**
 * Task status states
 */
export enum TaskStatus {
  AVAILABLE = 'available',
  ASSIGNED = 'assigned',
  STARTED = 'started',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Task entity
 */
export interface Task {
  /** Unique task identifier (UUID v4) */
  id: string;

  /** Task description */
  description: string;

  /** Array of assigned agent IDs */
  assignedAgents: string[];

  /** Task state */
  status: TaskStatus;

  /** Array of task IDs this task depends on */
  dependencies: string[];

  /** GitHub issue number */
  githubIssueId: string;

  /** Full GitHub issue URL */
  githubIssueUrl: string;

  /** Associated PR URL (optional) */
  githubPRUrl?: string | null;

  /** When task was created */
  createdAt: Date;

  /** When task was assigned (optional) */
  assignedAt?: Date | null;

  /** When work started (optional) */
  startedAt?: Date | null;

  /** When work finished (optional) */
  completedAt?: Date | null;

  /** Timestamp for conflict resolution */
  claimedAt?: Date | null;

  /** Progress percentage (0-100) */
  percentComplete?: number;

  /** Current status message */
  statusMessage?: string;
}

/**
 * Task creation data
 */
export interface TaskCreation {
  /** Task description */
  description: string;

  /** Array of task IDs this task depends on */
  dependencies?: string[];

  /** GitHub issue number */
  githubIssueId: string;

  /** Full GitHub issue URL */
  githubIssueUrl: string;
}

/**
 * Task update data
 */
export interface TaskUpdate {
  /** Update task status */
  status?: TaskStatus;

  /** Update assigned agents */
  assignedAgents?: string[];

  /** Update GitHub PR URL */
  githubPRUrl?: string | null;

  /** Update assigned timestamp */
  assignedAt?: Date | null;

  /** Update started timestamp */
  startedAt?: Date | null;

  /** Update completed timestamp */
  completedAt?: Date | null;

  /** Update progress percentage */
  percentComplete?: number;

  /** Update status message */
  statusMessage?: string;
}

/**
 * Task query filter
 */
export interface TaskQuery {
  /** Filter by task status */
  status?: TaskStatus;

  /** Filter by assigned agent ID */
  assignedToAgent?: string;

  /** Filter by whether task has dependencies */
  hasDependencies?: boolean;

  /** Filter by whether dependencies are complete */
  dependenciesComplete?: boolean;

  /** Filter by GitHub issue ID */
  githubIssueId?: string;

  /** Filter by creation date range */
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Validate task object
 */
export function validateTask(task: unknown): task is Task {
  if (typeof task !== 'object' || task === null) {
    return false;
  }

  const t = task as Partial<Task>;

  return (
    typeof t.id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      t.id
    ) &&
    typeof t.description === 'string' &&
    t.description.length > 0 &&
    t.description.length <= 500 &&
    Array.isArray(t.assignedAgents) &&
    t.assignedAgents.every((id) => typeof id === 'string') &&
    typeof t.status === 'string' &&
    Object.values(TaskStatus).includes(t.status as TaskStatus) &&
    Array.isArray(t.dependencies) &&
    t.dependencies.every((id) => typeof id === 'string') &&
    typeof t.githubIssueId === 'string' &&
    typeof t.githubIssueUrl === 'string' &&
    t.createdAt instanceof Date
  );
}

/**
 * Check if a task matches a query
 */
export function matchesTaskQuery(
  task: Task,
  query: TaskQuery,
  allTasks?: Map<string, Task>
): boolean {
  if (query.status && task.status !== query.status) {
    return false;
  }

  if (query.assignedToAgent && !task.assignedAgents.includes(query.assignedToAgent)) {
    return false;
  }

  if (query.hasDependencies !== undefined) {
    const hasDeps = task.dependencies.length > 0;
    if (query.hasDependencies !== hasDeps) {
      return false;
    }
  }

  if (query.dependenciesComplete !== undefined && allTasks) {
    const depsComplete = task.dependencies.every((depId) => {
      const dep = allTasks.get(depId);
      return dep?.status === TaskStatus.COMPLETED;
    });
    if (query.dependenciesComplete !== depsComplete) {
      return false;
    }
  }

  if (query.githubIssueId && task.githubIssueId !== query.githubIssueId) {
    return false;
  }

  if (query.createdAfter && task.createdAt < query.createdAfter) {
    return false;
  }

  if (query.createdBefore && task.createdAt > query.createdBefore) {
    return false;
  }

  return true;
}

/**
 * Create a task from creation data
 */
export function createTask(id: string, data: TaskCreation): Task {
  return {
    id,
    description: data.description,
    assignedAgents: [],
    status: TaskStatus.AVAILABLE,
    dependencies: data.dependencies || [],
    githubIssueId: data.githubIssueId,
    githubIssueUrl: data.githubIssueUrl,
    githubPRUrl: null,
    createdAt: new Date(),
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    claimedAt: null,
    percentComplete: 0,
  };
}

/**
 * Update a task with partial data
 */
export function updateTask(task: Task, update: TaskUpdate): Task {
  return {
    ...task,
    ...(update.status !== undefined && { status: update.status }),
    ...(update.assignedAgents !== undefined && {
      assignedAgents: update.assignedAgents,
    }),
    ...(update.githubPRUrl !== undefined && { githubPRUrl: update.githubPRUrl }),
    ...(update.assignedAt !== undefined && { assignedAt: update.assignedAt }),
    ...(update.startedAt !== undefined && { startedAt: update.startedAt }),
    ...(update.completedAt !== undefined && { completedAt: update.completedAt }),
    ...(update.percentComplete !== undefined && {
      percentComplete: update.percentComplete,
    }),
    ...(update.statusMessage !== undefined && {
      statusMessage: update.statusMessage,
    }),
  };
}

/**
 * Assign a task to an agent
 */
export function assignTask(task: Task, agentId: string): Task {
  return updateTask(task, {
    status: TaskStatus.ASSIGNED,
    assignedAgents: [...task.assignedAgents, agentId],
    assignedAt: new Date(),
  });
}

/**
 * Start a task
 */
export function startTask(task: Task): Task {
  return updateTask(task, {
    status: TaskStatus.STARTED,
    startedAt: new Date(),
    percentComplete: 0,
  });
}

/**
 * Mark task as in progress
 */
export function progressTask(
  task: Task,
  percentComplete: number,
  statusMessage?: string
): Task {
  return updateTask(task, {
    status: TaskStatus.IN_PROGRESS,
    percentComplete: Math.max(0, Math.min(100, percentComplete)),
    statusMessage,
  });
}

/**
 * Block a task
 */
export function blockTask(task: Task, reason: string): Task {
  return updateTask(task, {
    status: TaskStatus.BLOCKED,
    statusMessage: reason,
  });
}

/**
 * Complete a task
 */
export function completeTask(task: Task, githubPRUrl?: string): Task {
  return updateTask(task, {
    status: TaskStatus.COMPLETED,
    completedAt: new Date(),
    percentComplete: 100,
    githubPRUrl: githubPRUrl || task.githubPRUrl,
  });
}

/**
 * Fail a task
 */
export function failTask(task: Task, error: string): Task {
  return updateTask(task, {
    status: TaskStatus.FAILED,
    completedAt: new Date(),
    statusMessage: error,
  });
}

/**
 * Check if task is available for assignment
 */
export function isTaskAvailable(task: Task, allTasks?: Map<string, Task>): boolean {
  if (task.status !== TaskStatus.AVAILABLE) {
    return false;
  }

  // Check if all dependencies are completed
  if (allTasks) {
    return task.dependencies.every((depId) => {
      const dep = allTasks.get(depId);
      return dep?.status === TaskStatus.COMPLETED;
    });
  }

  // If no task map provided, just check status
  return task.dependencies.length === 0;
}

/**
 * Check if task is in a terminal state
 */
export function isTaskTerminal(task: Task): boolean {
  return [TaskStatus.COMPLETED, TaskStatus.FAILED].includes(task.status);
}

/**
 * Get task duration in milliseconds
 */
export function getTaskDuration(task: Task): number | null {
  if (!task.startedAt) {
    return null;
  }

  const endTime = task.completedAt || new Date();
  return endTime.getTime() - task.startedAt.getTime();
}

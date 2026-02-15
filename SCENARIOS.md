# CoorChat Example Scenarios

Real-world examples of multi-agent coordination using CoorChat.

## Table of Contents

1. [Scenario 1: Feature Development Workflow](#scenario-1-feature-development-workflow)
2. [Scenario 2: Bug Fix Coordination](#scenario-2-bug-fix-coordination)
3. [Scenario 3: Code Review Pipeline](#scenario-3-code-review-pipeline)
4. [Scenario 4: Infrastructure Deployment](#scenario-4-infrastructure-deployment)
5. [Scenario 5: Security Audit](#scenario-5-security-audit)
6. [Running These Scenarios](#running-these-scenarios)

---

## Scenario 1: Feature Development Workflow

**Goal**: Coordinate development, testing, and documentation for a new feature

**Agents Involved**:
- Developer Agent (implements feature)
- Tester Agent (writes and runs tests)
- Documentation Writer (updates docs)
- Architect (reviews design)

### Setup

```bash
# Terminal 1: Start Redis
docker run -d --name coorchat-redis -p 6379:6379 redis:7-alpine

# Generate shared token
TOKEN=$(node -e "console.log('cct_' + require('crypto').randomBytes(32).toString('hex'))")
echo "Shared Token: $TOKEN"
```

### Run Agents

```bash
# Terminal 2: Developer Agent
cd packages/mcp-server
CHANNEL_TYPE=redis \
REDIS_HOST=localhost \
REDIS_PORT=6379 \
SHARED_TOKEN=$TOKEN \
AGENT_ID=dev-agent-1 \
AGENT_ROLE=developer \
npm run cli -- agent start --role developer

# Terminal 3: Tester Agent
CHANNEL_TYPE=redis \
REDIS_HOST=localhost \
REDIS_PORT=6379 \
SHARED_TOKEN=$TOKEN \
AGENT_ID=test-agent-1 \
AGENT_ROLE=tester \
npm run cli -- agent start --role tester

# Terminal 4: Documentation Agent
CHANNEL_TYPE=redis \
REDIS_HOST=localhost \
REDIS_PORT=6379 \
SHARED_TOKEN=$TOKEN \
AGENT_ID=doc-agent-1 \
AGENT_ROLE=documentation-writer \
npm run cli -- agent start --role documentation-writer

# Terminal 5: Monitor Activity
npm run cli -- monitor
```

### Workflow

1. **GitHub Issue Created**: `Add user authentication feature`
2. **Architect Agent** reviews requirements, creates technical spec
3. **Developer Agent** picks up task, implements authentication
4. **Tester Agent** automatically notified when code is ready
5. **Tester Agent** writes tests, runs them
6. **Documentation Agent** updates API docs
7. **All agents** report completion, task marked done

### Expected Message Flow

```
[09:00:00] TASK_ASSIGNED
  From: github-sync
  To: dev-agent-1
  Payload: {
    "taskId": "issue-123",
    "description": "Add user authentication",
    "githubIssue": "https://github.com/org/repo/issues/123"
  }

[09:15:00] TASK_STARTED
  From: dev-agent-1
  Payload: {
    "taskId": "issue-123",
    "status": "in_progress"
  }

[10:30:00] TASK_PROGRESS
  From: dev-agent-1
  Payload: {
    "taskId": "issue-123",
    "message": "Authentication endpoints implemented",
    "completionPercentage": 60
  }

[11:00:00] TASK_COMPLETED
  From: dev-agent-1
  Payload: {
    "taskId": "issue-123",
    "branch": "feature/user-auth",
    "pullRequest": "https://github.com/org/repo/pull/456"
  }

[11:00:01] TASK_ASSIGNED
  From: task-queue
  To: test-agent-1
  Payload: {
    "taskId": "test-issue-123",
    "dependsOn": "issue-123",
    "testTarget": "feature/user-auth"
  }
```

---

## Scenario 2: Bug Fix Coordination

**Goal**: Quickly triage, fix, test, and deploy a critical bug

**Agents Involved**:
- Triage Agent (analyzes bug reports)
- Developer Agent (fixes bug)
- Tester Agent (regression testing)
- Infrastructure Agent (hotfix deployment)

### Setup

```bash
# Use GitHub integration for automatic bug sync
GITHUB_TOKEN=ghp_your_token
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32)
```

### Workflow

1. **User reports bug** via GitHub issue with label `bug` and `priority:critical`
2. **Triage Agent** automatically assigned, analyzes stack trace
3. **Developer Agent** receives assignment with triage analysis
4. **Developer Agent** creates hotfix branch, fixes bug
5. **Tester Agent** runs regression test suite
6. **Infrastructure Agent** deploys hotfix to production
7. **All agents** notify completion, GitHub issue auto-closed

### Test Script

Create `scenarios/bug-fix-test.ts`:

```typescript
import { TaskQueue } from '../src/tasks/TaskQueue.js';
import { AgentRegistry } from '../src/agents/AgentRegistry.js';
import { Task } from '../src/tasks/Task.js';

// Simulate critical bug workflow
const queue = new TaskQueue();
const registry = new AgentRegistry();

// Register agents
const triageAgent = registry.registerAgent({
  id: 'triage-agent-1',
  role: 'tester',
  capabilities: ['bug-triage', 'log-analysis'],
  status: 'active',
  metadata: { specialization: 'triage' },
});

const devAgent = registry.registerAgent({
  id: 'dev-agent-1',
  role: 'developer',
  capabilities: ['javascript', 'typescript', 'bugfix'],
  status: 'active',
  metadata: {},
});

// Create critical bug task
const bugTask: Task = {
  id: 'bug-critical-001',
  description: 'Fix: Payment processing timeout',
  requiredCapabilities: ['bug-triage'],
  priority: 'critical',
  status: 'pending',
  createdAt: new Date(),
  metadata: {
    githubIssue: 'https://github.com/org/repo/issues/789',
    errorMessage: 'Timeout after 30s',
    affectedUsers: 1523,
  },
};

// Add to queue
await queue.addTask(bugTask);

// Triage agent analyzes
const assigned = await queue.assignTask(triageAgent.id);
console.log('Bug assigned to triage:', assigned);

// Create fix task after triage
const fixTask: Task = {
  id: 'bug-fix-001',
  description: 'Implement fix for payment timeout',
  requiredCapabilities: ['bugfix', 'javascript'],
  priority: 'critical',
  status: 'pending',
  dependencies: ['bug-critical-001'],
  createdAt: new Date(),
  metadata: {
    triageAnalysis: 'Database connection pool exhaustion',
    suggestedFix: 'Increase pool size and add timeout handling',
  },
};

await queue.addTask(fixTask);
```

---

## Scenario 3: Code Review Pipeline

**Goal**: Automated code review coordination

**Agents Involved**:
- Security Auditor (checks for vulnerabilities)
- Code Reviewer (style and best practices)
- Test Agent (coverage validation)
- Architect (design review)

### Workflow

1. **Pull Request created** on GitHub
2. **Security Auditor** scans for common vulnerabilities (SQL injection, XSS, etc.)
3. **Code Reviewer** checks code style, naming conventions
4. **Test Agent** validates 80%+ code coverage
5. **Architect** reviews architectural changes
6. **All agents** must approve before merge

### Configuration

Create `scenarios/code-review-config.json`:

```json
{
  "reviewPipeline": {
    "requiredReviewers": [
      {
        "agentRole": "security-auditor",
        "checks": ["owasp-top-10", "dependency-scan", "secrets-detection"]
      },
      {
        "agentRole": "developer",
        "checks": ["code-style", "naming-conventions", "complexity"]
      },
      {
        "agentRole": "tester",
        "checks": ["coverage-threshold", "test-quality"]
      },
      {
        "agentRole": "architect",
        "checks": ["design-patterns", "architecture-compliance"],
        "requiredForFiles": ["src/core/**", "src/api/**"]
      }
    ],
    "approvalThreshold": "all",
    "autoMerge": false
  }
}
```

### Implementation

```typescript
// File: scenarios/code-review.ts
import { WebhookHandler } from '../src/github/WebhookHandler.js';
import { TaskQueue } from '../src/tasks/TaskQueue.js';

const webhookHandler = new WebhookHandler({
  port: 3000,
  path: '/webhook',
  secret: process.env.GITHUB_WEBHOOK_SECRET!,
});

webhookHandler.on('pull_request.opened', async (payload) => {
  const pr = payload.pull_request;

  // Create review tasks for each reviewer type
  const reviewTasks = [
    {
      id: `security-review-${pr.number}`,
      description: `Security review for PR #${pr.number}`,
      requiredCapabilities: ['security-audit', 'vulnerability-scan'],
      priority: 'high' as const,
      status: 'pending' as const,
      createdAt: new Date(),
      metadata: {
        prNumber: pr.number,
        prUrl: pr.html_url,
        reviewType: 'security',
      },
    },
    {
      id: `code-review-${pr.number}`,
      description: `Code style review for PR #${pr.number}`,
      requiredCapabilities: ['code-review', 'style-check'],
      priority: 'medium' as const,
      status: 'pending' as const,
      createdAt: new Date(),
      metadata: {
        prNumber: pr.number,
        prUrl: pr.html_url,
        reviewType: 'code-quality',
      },
    },
    {
      id: `test-review-${pr.number}`,
      description: `Test coverage review for PR #${pr.number}`,
      requiredCapabilities: ['testing', 'coverage-analysis'],
      priority: 'medium' as const,
      status: 'pending' as const,
      createdAt: new Date(),
      metadata: {
        prNumber: pr.number,
        prUrl: pr.html_url,
        reviewType: 'test-coverage',
        coverageThreshold: 80,
      },
    },
  ];

  // Add all review tasks
  const queue = new TaskQueue();
  for (const task of reviewTasks) {
    await queue.addTask(task);
  }

  console.log(`Created ${reviewTasks.length} review tasks for PR #${pr.number}`);
});

await webhookHandler.start();
```

---

## Scenario 4: Infrastructure Deployment

**Goal**: Coordinate multi-stage deployment with validation

**Agents Involved**:
- Backend Developer (API deployment)
- Frontend Developer (UI deployment)
- Infrastructure Agent (Kubernetes/Docker)
- Tester Agent (smoke tests)

### Workflow

```
1. Backend Agent deploys API to staging
   ↓
2. Infrastructure Agent validates health checks
   ↓
3. Frontend Agent deploys UI to staging
   ↓
4. Tester Agent runs smoke tests
   ↓ (if tests pass)
5. Infrastructure Agent promotes to production
   ↓
6. Tester Agent runs production smoke tests
   ↓
7. All agents report success
```

### Dependency Chain

```typescript
import { DependencyTracker } from '../src/tasks/DependencyTracker.js';

const tracker = new DependencyTracker();

// Define deployment tasks with dependencies
const tasks = [
  { id: 'deploy-api-staging', dependencies: [] },
  { id: 'validate-api-health', dependencies: ['deploy-api-staging'] },
  { id: 'deploy-ui-staging', dependencies: ['validate-api-health'] },
  { id: 'run-smoke-tests', dependencies: ['deploy-ui-staging'] },
  { id: 'deploy-api-prod', dependencies: ['run-smoke-tests'] },
  { id: 'deploy-ui-prod', dependencies: ['deploy-api-prod'] },
  { id: 'run-prod-smoke-tests', dependencies: ['deploy-ui-prod'] },
];

// Add all dependencies
for (const task of tasks) {
  for (const dep of task.dependencies) {
    tracker.addDependency(task.id, dep);
  }
}

// Check which tasks are ready
const ready = tracker.getReadyTasks();
console.log('Tasks ready to execute:', ready);

// Mark task complete and get newly unblocked tasks
const unblocked = tracker.markCompleted('deploy-api-staging');
console.log('Newly unblocked tasks:', unblocked);
```

---

## Scenario 5: Security Audit

**Goal**: Comprehensive security review of codebase

**Agents Involved**:
- Security Auditor (vulnerability scanning)
- Developer (fix implementation)
- Tester (security test validation)
- Documentation Writer (security docs)

### Workflow

1. **Security Auditor** scans entire codebase
2. **Creates tasks** for each finding (by severity)
3. **Developer Agents** assigned based on file ownership
4. **Each fix** reviewed by Security Auditor
5. **Tester Agent** validates fixes don't introduce regressions
6. **Documentation Agent** updates security guidelines

### Security Scan Example

```typescript
// File: scenarios/security-audit.ts
import { TaskQueue } from '../src/tasks/TaskQueue.js';
import { Task } from '../src/tasks/Task.js';

interface SecurityFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  file: string;
  line: number;
  description: string;
  recommendation: string;
}

const findings: SecurityFinding[] = [
  {
    severity: 'critical',
    category: 'SQL Injection',
    file: 'src/database/queries.ts',
    line: 45,
    description: 'Unsanitized user input in SQL query',
    recommendation: 'Use parameterized queries',
  },
  {
    severity: 'high',
    category: 'XSS',
    file: 'src/ui/UserProfile.tsx',
    line: 123,
    description: 'Unescaped user content rendered',
    recommendation: 'Use DOMPurify or framework escaping',
  },
  // ... more findings
];

// Create tasks for each finding
const queue = new TaskQueue();

for (const finding of findings) {
  const task: Task = {
    id: `security-fix-${finding.file}-${finding.line}`,
    description: `[${finding.severity.toUpperCase()}] Fix ${finding.category} in ${finding.file}`,
    requiredCapabilities: ['security', finding.category.toLowerCase()],
    priority: finding.severity === 'critical' ? 'critical' : 'high',
    status: 'pending',
    createdAt: new Date(),
    metadata: {
      securityFinding: finding,
      file: finding.file,
      line: finding.line,
      recommendation: finding.recommendation,
    },
  };

  await queue.addTask(task);
}

console.log(`Created ${findings.length} security fix tasks`);
```

---

## Running These Scenarios

### Option 1: Automated Test Suite

```bash
# Run all scenario tests
cd packages/mcp-server
npm run scenarios

# Run specific scenario
npm run scenario -- code-review
```

### Option 2: Interactive Demo

```bash
# Start demo environment
./scripts/demo-setup.sh

# This will:
# 1. Start Redis
# 2. Start 4 agents (developer, tester, architect, security)
# 3. Load example GitHub issues
# 4. Show real-time coordination
```

### Option 3: Manual Execution

```bash
# Terminal 1: Start infrastructure
docker-compose up -d

# Terminal 2-5: Start agents
npm run cli -- agent start --role developer
npm run cli -- agent start --role tester
npm run cli -- agent start --role security-auditor
npm run cli -- agent start --role architect

# Terminal 6: Monitor
npm run cli -- monitor

# Terminal 7: Trigger scenario
node scenarios/feature-development.js
```

---

## Scenario Metrics

Track coordination effectiveness:

```typescript
interface ScenarioMetrics {
  totalTasks: number;
  completedTasks: number;
  averageTaskTime: number; // milliseconds
  agentUtilization: Record<string, number>; // percentage
  taskSuccessRate: number; // percentage
  coordinationOverhead: number; // milliseconds (avg message latency)
}

// Example output:
{
  totalTasks: 15,
  completedTasks: 15,
  averageTaskTime: 45000, // 45 seconds
  agentUtilization: {
    'dev-agent-1': 85,
    'test-agent-1': 60,
    'security-agent-1': 40,
  },
  taskSuccessRate: 100,
  coordinationOverhead: 120, // 120ms average
}
```

---

## Custom Scenarios

Create your own scenario:

```typescript
// File: scenarios/my-scenario.ts
import { ScenarioRunner } from './utils/ScenarioRunner.js';

const scenario = new ScenarioRunner({
  name: 'My Custom Workflow',
  agents: [
    { role: 'developer', count: 2 },
    { role: 'tester', count: 1 },
  ],
  tasks: [
    {
      description: 'Implement feature X',
      assignTo: 'developer',
      dependencies: [],
    },
    {
      description: 'Test feature X',
      assignTo: 'tester',
      dependencies: ['Implement feature X'],
    },
  ],
});

await scenario.run();
scenario.printMetrics();
```

---

## Next Steps

1. **Try the scenarios** - Start with Scenario 1 (Feature Development)
2. **Monitor activity** - Use `npm run cli -- monitor` to watch coordination
3. **Customize workflows** - Modify scenarios for your use case
4. **Measure performance** - Track metrics to optimize coordination
5. **Scale up** - Add more agents and parallel workflows

Happy coordinating! 🤖

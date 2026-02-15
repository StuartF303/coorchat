# 🤖 CoorChat

<div align="center">

**Multi-Agent Coordination System for AI-Powered Software Development**

[![Tests](https://img.shields.io/badge/tests-34%20passing-success)](./packages/mcp-server/tests)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-18+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

*Enable teams of specialized AI agents to coordinate on shared software development tasks through secure, real-time communication channels.*

[Quick Start](#-quick-start) • [Documentation](#-documentation) • [Examples](#-example-scenarios) • [CLI Reference](#-cli-tools)

</div>

---

## 🌟 What is CoorChat?

CoorChat is a **multi-agent coordination platform** that allows specialized AI agents (developers, testers, architects, security auditors, etc.) to collaborate on software development tasks just like human teams do.

### The Problem

AI agents working in isolation can't coordinate complex workflows:
- ❌ No shared context across multiple agents
- ❌ Duplicated work or conflicting changes
- ❌ No visibility into what other agents are doing
- ❌ Manual task assignment and dependency management

### The Solution

CoorChat provides a **secure coordination layer** enabling:
- ✅ **Real-time communication** between specialized agents
- ✅ **Automatic task distribution** based on agent capabilities
- ✅ **Dependency tracking** and conflict resolution
- ✅ **GitHub integration** for seamless issue/PR synchronization
- ✅ **Human oversight** through monitoring and audit trails

---

## ✨ Key Features

### 🔄 Multi-Agent Coordination
Agents with different specializations (developer, tester, architect, security, infrastructure, documentation) work together on shared tasks with automatic role matching and capability-based assignment.

### 🔐 Secure Communication
- Token-based authentication with timing-safe comparison
- HMAC message signing for integrity verification
- TLS/HTTPS enforcement for all channels
- Cryptographically secure token generation

### 📡 Multiple Channel Types
Choose the communication channel that fits your infrastructure:
- **Redis** - Fast, reliable pub/sub (recommended for self-hosted)
- **Discord** - Zero setup, great for testing and small teams
- **SignalR** - Enterprise-grade .NET relay server for distributed teams

### 🔗 GitHub Integration
- Automatic synchronization of issues and pull requests
- Webhook + polling fallback for reliability
- Task creation from GitHub events
- Bi-directional updates (agent actions → GitHub comments)

### 🎯 Smart Task Management
- **Dependency tracking** with cycle detection
- **Conflict resolution** when multiple agents claim the same task
- **Priority queuing** (critical → high → medium → low)
- **Lifecycle events** (assigned → started → blocked → progress → completed)

### 👥 Extensible Role System
8 predefined roles + custom role support:
```
developer, tester, architect, frontend, backend,
infrastructure, security-auditor, documentation-writer
```

### 📊 Monitoring & Observability
- Real-time activity monitoring
- Structured logging (JSON format)
- Task lifecycle tracking
- Agent timeout detection

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Issues/PRs                       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
         ┌───────────────┐
         │ GitHub Sync   │ (Webhook + Polling)
         │   Manager     │
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │  Task Queue   │ ◄──── Priority, Dependencies
         └───────┬───────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌───────┐   ┌───────┐   ┌───────┐
│ Agent │   │ Agent │   │ Agent │  Developer, Tester, etc.
│   1   │   │   2   │   │   3   │
└───┬───┘   └───┬───┘   └───┬───┘
    │           │           │
    └───────────┼───────────┘
                │
                ▼
    ┌───────────────────────┐
    │  Communication Layer  │
    │  (Redis/Discord/      │
    │   SignalR)            │
    └───────────────────────┘
```

### Components

**MCP Server** (`packages/mcp-server/`)
- TypeScript/Node.js coordination client
- Integrates with Claude Desktop via MCP protocol
- Handles agent registration, task management, messaging

**Relay Server** (`packages/relay-server/`)
- C#/.NET SignalR hub (optional)
- Enterprise-grade relay for distributed teams
- Token authentication middleware

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Docker** (optional, for Redis) ([Download](https://www.docker.com/))
- **Git** ([Download](https://git-scm.com/))

### Option 1: Automated Setup ⚡ (Recommended)

**Linux/macOS:**
```bash
git clone https://github.com/stuartf303/coorchat.git
cd coorchat
chmod +x quick-start.sh
./quick-start.sh
```

**Windows (PowerShell):**
```powershell
git clone https://github.com/stuartf303/coorchat.git
cd coorchat
.\quick-start.ps1
```

This will:
1. ✅ Install all dependencies
2. ✅ Generate secure authentication token
3. ✅ Set up your chosen channel (Redis/Discord/SignalR)
4. ✅ Run the test suite (34 tests)
5. ✅ Generate Claude Desktop configuration

### Option 2: Manual Installation

```bash
# 1. Clone and install
git clone https://github.com/stuartf303/coorchat.git
cd coorchat/packages/mcp-server
npm install
npm run build

# 2. Generate secure token
npm run cli -- token generate
# Output: cct_a3f8d9e2c1b4f7a6e8d2c9b1f4a7e3d2...

# 3. Start Redis (or use Discord/SignalR)
docker run -d --name coorchat-redis -p 6379:6379 redis:7-alpine

# 4. Configure environment
cat > .env << EOF
CHANNEL_TYPE=redis
REDIS_HOST=localhost
REDIS_PORT=6379
SHARED_TOKEN=cct_YOUR_TOKEN_FROM_STEP2
AGENT_ID=agent-1
AGENT_ROLE=developer
EOF

# 5. Start an agent
npm run cli -- agent start --role developer
```

### Verify Installation

```bash
# Run tests
npm test

# Expected output:
# Test Files  2 passed (2)
# Tests  34 passed (34)
```

---

## 🎯 Example Scenarios

### Scenario 1: Feature Development Workflow

Coordinate developer, tester, and documentation agents on a new feature:

```bash
# Terminal 1: Developer Agent
AGENT_ID=dev-1 AGENT_ROLE=developer npm run cli -- agent start

# Terminal 2: Tester Agent
AGENT_ID=test-1 AGENT_ROLE=tester npm run cli -- agent start

# Terminal 3: Documentation Agent
AGENT_ID=doc-1 AGENT_ROLE=documentation-writer npm run cli -- agent start

# Terminal 4: Monitor Activity
npm run cli -- monitor
```

**What happens:**
1. GitHub issue created: "Add user authentication"
2. Developer agent picks up task, implements feature
3. Tester agent automatically notified when code is ready
4. Tester writes and runs tests
5. Documentation agent updates API docs
6. All agents report completion → task marked done

### Scenario 2: Bug Fix Coordination

Critical bug workflow with automatic triage and deployment:

```bash
# Agents automatically coordinate through these stages:
User reports bug → Triage analysis → Developer fixes →
Tester validates → Infrastructure deploys → Done
```

**See [SCENARIOS.md](./SCENARIOS.md) for 5 complete workflow examples** including:
- Feature development
- Bug fix coordination
- Code review pipeline
- Infrastructure deployment
- Security audit

---

## 🛠️ CLI Tools

CoorChat includes a full-featured CLI for managing agents, tokens, and monitoring:

```bash
# Token Management
npm run cli -- token generate              # Generate secure token
npm run cli -- token validate <token>      # Validate token format
npm run cli -- token hash <token>          # SHA-256 hash

# Agent Control
npm run cli -- agent start --role developer
npm run cli -- agent start --id my-agent --role tester
npm run cli -- agent list                  # List active agents

# Role Management
npm run cli -- role list                   # Show all available roles
npm run cli -- role suggest testing security  # Suggest roles by capability

# Configuration
npm run cli -- config show                 # Show current config
npm run cli -- config init --channel redis # Initialize config

# Monitoring
npm run cli -- monitor                     # Watch real-time coordination
```

**Full CLI documentation:** [CLI.md](./packages/mcp-server/CLI.md)

---

## 📚 Documentation

### Getting Started
- **[Installation Guide](./INSTALL.md)** - Complete setup for all platforms and channels
- **[Quick Start Scripts](./quick-start.sh)** - Automated installation
- **[CLI Reference](./packages/mcp-server/CLI.md)** - Command-line tool documentation

### Guides & Examples
- **[Example Scenarios](./SCENARIOS.md)** - Real-world coordination workflows
- **[Specifications](./specs/001-multi-agent-coordination/)** - Feature specs and design docs

### Configuration
- **[Environment Variables](./INSTALL.md#environment-variables-reference)** - All config options
- **[Channel Setup](./INSTALL.md#step-3-choose-your-channel)** - Redis, Discord, SignalR

### Development
- **[Project Structure](#project-structure)** - Codebase organization
- **[Contributing](#contributing)** - Development workflow
- **[Testing](#testing)** - Running tests

---

## 🏗️ Project Structure

```
coorchat/
├── packages/
│   ├── mcp-server/              # TypeScript/Node.js MCP Server
│   │   ├── src/
│   │   │   ├── agents/          # Agent registry, roles, capabilities
│   │   │   ├── channels/        # Discord, SignalR, Redis channels
│   │   │   ├── cli/             # Command-line interface
│   │   │   ├── config/          # Configuration, token generation
│   │   │   ├── github/          # GitHub integration (webhooks, polling)
│   │   │   ├── logging/         # Structured logging
│   │   │   ├── protocol/        # Message protocol, validation
│   │   │   └── tasks/           # Task queue, dependencies, conflicts
│   │   └── tests/
│   │       └── integration/     # Integration test suites
│   │
│   └── relay-server/            # C#/.NET SignalR Relay (optional)
│       └── src/
│           ├── Api/             # SignalR hub, middleware
│           └── Core/            # Authentication service
│
├── specs/                       # Feature specifications
│   └── 001-multi-agent-coordination/
│       ├── spec.md              # Feature specification
│       ├── plan.md              # Implementation plan
│       ├── data-model.md        # Entity models
│       ├── contracts/           # API contracts
│       └── tasks.md             # Task breakdown
│
├── .github/                     # CI/CD workflows
│   └── workflows/
│       ├── mcp-server-ci.yml    # TypeScript tests
│       └── relay-server-ci.yml  # C# tests
│
├── quick-start.sh               # Automated setup (Bash)
├── quick-start.ps1              # Automated setup (PowerShell)
├── docker-compose.yml           # Local development stack
├── INSTALL.md                   # Installation guide
├── SCENARIOS.md                 # Example workflows
└── README.md                    # This file
```

---

## 🧪 Testing

CoorChat includes comprehensive integration tests:

```bash
cd packages/mcp-server

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests only
npm run test:integration
```

### Test Suites

**Agent-Task Coordination** (10 tests)
- Agent registration and discovery
- Task assignment with role matching
- Dependency tracking and automatic unblocking
- Conflict resolution
- Lifecycle event handling
- Complete workflow orchestration

**Secure Communication** (24 tests)
- Token generation (entropy, uniqueness, formats)
- Token validation (format, length, characters)
- Token hashing (consistency, collision resistance)
- Channel authentication (rejection, verification, timing-safety)
- Message security (metadata, integrity, tampering detection)
- Security best practices
- TLS/encryption support
- Edge cases

**Current Status:** ✅ 34/34 tests passing

---

## 🔒 Security Features

### Authentication
- **Token-based authentication** with 16+ character minimum
- **Timing-safe comparison** prevents timing attacks
- **SHA-256 token hashing** for secure storage
- **Token prefixes** (cct_, cca_) for type identification

### Message Security
- **HMAC-SHA256 signatures** for Redis message integrity
- **Correlation IDs** for request/response tracking
- **Timestamp validation** for replay attack prevention

### Transport Security
- **TLS enforcement** for Redis (rediss://)
- **HTTPS validation** for SignalR
- **Environment-based policies** (production vs development)

### Best Practices
- **No plaintext token storage**
- **Secure random generation** using crypto.randomBytes()
- **Automatic security warnings** for insecure configurations

---

## 🎨 Use Cases

### Software Development Teams
- Coordinate multiple AI agents on feature development
- Automated code review pipeline
- Bug triage and fix coordination
- Documentation generation

### DevOps & Infrastructure
- Multi-stage deployment orchestration
- Infrastructure as code coordination
- Automated security audits
- Compliance checking

### Quality Assurance
- Automated test generation
- Regression test coordination
- Coverage analysis
- Performance testing

### Research & Experimentation
- Multi-agent AI research
- Coordination algorithm testing
- Custom workflow prototyping
- Agent capability experiments

---

## 🗺️ Roadmap

### Current Version: MVP (v1.0)
- ✅ Multi-agent coordination
- ✅ 3 channel types (Redis, Discord, SignalR)
- ✅ GitHub integration
- ✅ Secure authentication
- ✅ Task dependencies
- ✅ Conflict resolution
- ✅ CLI tool
- ✅ Comprehensive documentation

### Planned Features
- 🔲 Web dashboard for monitoring
- 🔲 Metrics and analytics
- 🔲 Agent performance tracking
- 🔲 Advanced conflict resolution strategies
- 🔲 Multi-repository coordination
- 🔲 Slack/Teams integration
- 🔲 Plugin system
- 🔲 Agent marketplace

---

## 🤝 Contributing

We welcome contributions! CoorChat follows the **Specify workflow**:

1. **Specification** - Define the feature clearly
2. **Clarification** - Resolve ambiguities
3. **Planning** - Create implementation plan
4. **Task Generation** - Break down into tasks
5. **Implementation** - Execute the plan

### Development Setup

```bash
# Clone and install
git clone https://github.com/stuartf303/coorchat.git
cd coorchat/packages/mcp-server
npm install

# Run tests
npm test

# Run in development mode
npm run dev

# Lint and format
npm run lint
npm run format
```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure all tests pass (`npm test`)
4. Update documentation as needed
5. Submit PR with clear description
6. Wait for CI/CD checks
7. Address review feedback

**See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines**

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for details.

```
MIT License

Copyright (c) 2026 CoorChat Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

[Full MIT License text...]
```

---

## 🙏 Acknowledgments

- **Claude (Anthropic)** - AI pair programming partner
- **Model Context Protocol (MCP)** - Agent integration framework
- **Specify** - Specification-driven development workflow
- **Open Source Community** - For the amazing libraries used in this project

---

## 📞 Support & Community

- **Documentation**: [Read the docs](./INSTALL.md)
- **Issues**: [Report bugs or request features](https://github.com/stuartf303/coorchat/issues)
- **Discussions**: [Ask questions or share ideas](https://github.com/stuartf303/coorchat/discussions)

---

## ⭐ Star History

If you find CoorChat useful, please consider giving it a star! ⭐

[![Star History](https://api.star-history.com/svg?repos=stuartf303/coorchat&type=Date)](https://star-history.com/#stuartf303/coorchat&Date)

---

<div align="center">

**Made with ❤️ by developers, for developers**

[⬆ Back to Top](#-coorchat)

</div>

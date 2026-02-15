# CoorChat: Multi-Agent Coordination System

A real-time coordination system enabling multiple specialized AI agents (developer, tester, architect, frontend, backend, infrastructure, and custom roles) to collaborate on shared software development tasks.

## Project Status

🚧 **In Development** - Foundation phase complete, core features in progress

## Features

- ✅ **Multi-Agent Coordination**: Specialized agents work together on shared tasks
- ✅ **GitHub Integration**: Automatic task sync with GitHub issues and PRs
- ✅ **Multi-Channel Support**: Discord, SignalR, Redis, or custom Relay Server
- ✅ **Secure Communication**: Token-based authentication and encrypted channels
- ✅ **Cross-Platform**: Linux, macOS, Windows, and CI/CD environments
- ✅ **Extensible Roles**: Define custom agent types on the fly

## Architecture

This is a monorepo containing two components:

- **MCP Server** (`packages/mcp-server/`): TypeScript/Node.js coordination client
- **Relay Server** (`packages/relay-server/`): C#/.NET optional self-hosted relay (coming soon)

## 🚀 Quick Start

**Choose your path**:

### Option 1: Automated Setup (Recommended)

```bash
# Linux/macOS
./quick-start.sh

# Windows (PowerShell)
.\quick-start.ps1
```

This will:
- ✅ Install dependencies
- ✅ Generate secure tokens
- ✅ Set up your chosen channel (Redis/Discord/SignalR)
- ✅ Run tests
- ✅ Generate Claude Desktop configuration

### Option 2: Manual Installation

See **[INSTALL.md](./INSTALL.md)** for complete installation guide.

```bash
cd packages/mcp-server
npm install && npm run build

# Generate token
npm run cli -- token generate

# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Configure and start
npm run cli -- agent start --role developer

# Or using Docker
docker-compose up
```

### Configuration

```bash
# Interactive configuration wizard
npm run configure

# Join as an agent
npm run join -- --role developer
```

See [quickstart.md](./specs/001-multi-agent-coordination/quickstart.md) for detailed setup instructions.

## Documentation

- [Feature Specification](./specs/001-multi-agent-coordination/spec.md)
- [Implementation Plan](./specs/001-multi-agent-coordination/plan.md)
- [Data Model](./specs/001-multi-agent-coordination/data-model.md)
- [API Contracts](./specs/001-multi-agent-coordination/contracts/)
- [Quick Start Guide](./specs/001-multi-agent-coordination/quickstart.md)
- [Task Breakdown](./specs/001-multi-agent-coordination/tasks.md)

## Development

```bash
# Run tests
npm test

# Run integration tests
npm run test:integration

# Build
npm run build

# Lint
npm run lint

# Format
npm run format
```

## Project Structure

```
coorchat/
├── packages/
│   ├── mcp-server/          # TypeScript/Node.js MCP Server
│   └── relay-server/        # C#/.NET Relay Server (optional)
├── specs/                   # Feature specifications and planning
├── .github/                 # CI/CD workflows
└── docker-compose.yml       # Local development setup
```

## 📚 Documentation

- **[INSTALL.md](./INSTALL.md)** - Complete installation guide with all channel options
- **[CLI.md](./packages/mcp-server/CLI.md)** - CLI command reference and usage examples
- **[SCENARIOS.md](./SCENARIOS.md)** - Real-world coordination scenarios and examples
- **[Specifications](./specs/001-multi-agent-coordination/)** - Feature specs, design docs, and task breakdown

### Quick Links

- [Token Management](./packages/mcp-server/CLI.md#token-management) - Generate and validate tokens
- [Agent Commands](./packages/mcp-server/CLI.md#agent-management) - Start and manage agents
- [Monitoring](./packages/mcp-server/CLI.md#monitoring) - Watch coordination in real-time
- [Example Scenarios](./SCENARIOS.md) - Feature development, bug fixes, code reviews, deployments

## Contributing

This project follows the Specify workflow:
1. Specification (`/speckit.specify`)
2. Clarification (`/speckit.clarify`)
3. Planning (`/speckit.plan`)
4. Task Generation (`/speckit.tasks`)
5. Implementation (`/speckit.implement`)

## License

MIT

## Support

- **Issues**: https://github.com/yourorg/coorchat/issues
- **Documentation**: See `specs/` directory

---

**Status**: Foundation complete. Core agent coordination functionality in progress.

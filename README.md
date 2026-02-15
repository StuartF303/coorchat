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

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (optional but recommended)
- GitHub Personal Access Token
- One of: Discord Bot Token, SignalR Hub, Redis Instance, or Relay Server

### Installation

```bash
# Clone repository
git clone https://github.com/yourorg/coorchat.git
cd coorchat

# Install dependencies (MCP Server)
cd packages/mcp-server
npm install

# Configure environment
cp .env.example .env
# Edit .env with your tokens and configuration

# Run locally
npm run dev

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

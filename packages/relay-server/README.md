# CoorChat Relay Server

Enterprise-grade SignalR relay server for CoorChat multi-agent coordination.

## Features

- ✅ **SignalR Hub** - Real-time bidirectional communication
- ✅ **Connection Management** - Thread-safe agent connection tracking
- ✅ **Authentication** - Token-based security with timing-safe comparison
- ✅ **Broadcasting** - Send messages to all agents
- ✅ **Unicast** - Send messages to specific agents
- ✅ **Health Checks** - Monitor server status
- ✅ **Statistics API** - Real-time connection metrics
- ✅ **CORS Support** - Cross-origin resource sharing
- ✅ **Swagger UI** - API documentation

## Quick Start

### Using Docker

```bash
# Build
docker build -t coorchat-relay .

# Run
docker run -d \
  -p 5000:5000 \
  -p 5001:5001 \
  -e Authentication__SharedToken=cct_your_secure_token \
  coorchat-relay
```

### Using .NET CLI

```bash
# Restore dependencies
dotnet restore

# Run in development mode
cd src/CoorChat.RelayServer.Api
dotnet run

# Build for production
dotnet publish -c Release -o ./publish
```

## Configuration

### appsettings.json

```json
{
  "Authentication": {
    "SharedToken": "YOUR_SECURE_TOKEN_HERE"
  },
  "Kestrel": {
    "Endpoints": {
      "Http": {
        "Url": "http://0.0.0.0:5000"
      },
      "Https": {
        "Url": "https://0.0.0.0:5001"
      }
    }
  }
}
```

### Environment Variables

```bash
# Required
Authentication__SharedToken=cct_your_secure_token

# Optional
ASPNETCORE_ENVIRONMENT=Development
ASPNETCORE_URLS=https://+:5001;http://+:5000
```

## Endpoints

### SignalR Hub

**URL**: `wss://localhost:5001/agentHub` or `ws://localhost:5000/agentHub`

**Hub Methods (Client → Server):**

- `RegisterAgent(agentId, role, metadata)` - Register agent connection
- `SendMessage(message)` - Broadcast message to all agents
- `SendMessageToAgent(recipientId, message)` - Send to specific agent
- `Heartbeat()` - Keep-alive ping
- `GetConnectedAgents()` - List all connected agents
- `QueryStatus(agentId)` - Check if agent is connected

**Hub Events (Server → Client):**

- `ReceiveMessage(message)` - Incoming message
- `AgentConnected(agentInfo)` - Agent joined
- `AgentDisconnected(agentInfo)` - Agent left
- `HeartbeatAck(timestamp)` - Heartbeat response
- `ConnectedAgents(agents)` - List of agents
- `AgentStatus(status)` - Agent status response
- `MessageError(error)` - Message delivery error

### REST API

**Root**: `GET /`
```json
{
  "name": "CoorChat Relay Server",
  "version": "1.0.0",
  "status": "running",
  "endpoints": {
    "hub": "/agentHub",
    "health": "/health",
    "swagger": "/swagger"
  }
}
```

**Health Check**: `GET /health`
```
Healthy
```

**Statistics**: `GET /api/stats`
```json
{
  "totalConnections": 5,
  "agents": [
    {
      "agentId": "dev-1",
      "role": "developer",
      "connectedAt": "2026-02-15T10:30:00Z",
      "lastActivity": "2026-02-15T10:35:00Z",
      "connectionDuration": "00:05:00"
    }
  ]
}
```

**Swagger UI**: `http://localhost:5000/` (in development)

## Message Format

### AgentMessage

```json
{
  "protocolVersion": "1.0.0",
  "messageType": "TASK_ASSIGNED",
  "senderId": "agent-1",
  "recipientId": "agent-2",
  "timestamp": "2026-02-15T10:30:00.000Z",
  "correlationId": "req-123",
  "priority": "high",
  "payload": {
    "taskId": "task-456",
    "description": "Implement feature X"
  },
  "metadata": {
    "source": "github",
    "issueNumber": 123
  }
}
```

## Client Example (C#)

```csharp
using Microsoft.AspNetCore.SignalR.Client;

var connection = new HubConnectionBuilder()
    .WithUrl("https://localhost:5001/agentHub", options =>
    {
        options.AccessTokenProvider = () => Task.FromResult("cct_your_token");
    })
    .WithAutomaticReconnect()
    .Build();

// Handle incoming messages
connection.On<AgentMessage>("ReceiveMessage", message =>
{
    Console.WriteLine($"Received: {message.MessageType} from {message.SenderId}");
});

// Connect
await connection.StartAsync();

// Register agent
await connection.InvokeAsync("RegisterAgent", "agent-1", "developer", new Dictionary<string, object>
{
    { "platform", "Windows" }
});

// Send message
var message = new AgentMessage
{
    MessageType = "HEARTBEAT",
    SenderId = "agent-1"
};

await connection.InvokeAsync("SendMessage", message);
```

## Client Example (TypeScript)

See `packages/mcp-server/src/channels/signalr/SignalRChannel.ts` for full implementation.

```typescript
import * as signalR from '@microsoft/signalr';

const connection = new signalR.HubConnectionBuilder()
  .withUrl('https://localhost:5001/agentHub', {
    accessTokenFactory: () => 'cct_your_token'
  })
  .withAutomaticReconnect()
  .build();

// Handle messages
connection.on('ReceiveMessage', (message) => {
  console.log('Received:', message);
});

// Connect
await connection.start();

// Register
await connection.invoke('RegisterAgent', 'agent-1', 'developer', {
  platform: 'Node.js'
});

// Send message
await connection.invoke('SendMessage', {
  protocolVersion: '1.0.0',
  messageType: 'HEARTBEAT',
  senderId: 'agent-1',
  timestamp: new Date().toISOString()
});
```

## Security

### Authentication

All SignalR connections require a valid token in the `Authorization` header or via `AccessTokenProvider`.

Token validation:
- Minimum 16 characters
- Timing-safe comparison
- SHA-256 hashed storage

### TLS/HTTPS

**Production**: Always use HTTPS (port 5001)

```bash
# Generate self-signed cert for testing
dotnet dev-certs https --trust
```

**Production**: Use a real certificate from Let's Encrypt, etc.

### CORS

Default configuration allows all origins (development only).

**Production**: Restrict CORS in `Program.cs`:

```csharp
policy
  .WithOrigins("https://your-app.com")
  .AllowCredentials();
```

## Monitoring

### Health Checks

```bash
curl https://localhost:5001/health
```

### Connection Statistics

```bash
curl https://localhost:5001/api/stats | jq
```

### Logging

Logs are written to console in JSON format (structured logging).

```bash
# View logs
docker logs -f coorchat-relay

# Filter by level
docker logs coorchat-relay 2>&1 | grep "\"LogLevel\":\"Error\""
```

## Deployment

### Docker

```bash
# Build
docker build -t coorchat-relay:1.0.0 .

# Run
docker run -d \
  --name coorchat-relay \
  -p 5001:5001 \
  -e Authentication__SharedToken=$SHARED_TOKEN \
  -e ASPNETCORE_ENVIRONMENT=Production \
  --restart unless-stopped \
  coorchat-relay:1.0.0
```

### Docker Compose

```yaml
version: '3.8'
services:
  relay-server:
    build: ./packages/relay-server
    ports:
      - "5001:5001"
    environment:
      - Authentication__SharedToken=${SHARED_TOKEN}
      - ASPNETCORE_ENVIRONMENT=Production
    restart: unless-stopped
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: coorchat-relay
spec:
  replicas: 3
  selector:
    matchLabels:
      app: coorchat-relay
  template:
    metadata:
      labels:
        app: coorchat-relay
    spec:
      containers:
      - name: relay-server
        image: coorchat-relay:1.0.0
        ports:
        - containerPort: 5001
        env:
        - name: Authentication__SharedToken
          valueFrom:
            secretKeyRef:
              name: coorchat-secrets
              key: shared-token
---
apiVersion: v1
kind: Service
metadata:
  name: coorchat-relay
spec:
  type: LoadBalancer
  ports:
  - port: 443
    targetPort: 5001
  selector:
    app: coorchat-relay
```

## Troubleshooting

### Connection Refused

```bash
# Check server is running
curl http://localhost:5000/health

# Check firewall
sudo ufw allow 5000
sudo ufw allow 5001
```

### Authentication Failed

```bash
# Verify token
echo $Authentication__SharedToken

# Check logs
docker logs coorchat-relay | grep Authentication
```

### WebSocket Connection Failed

```bash
# Test WebSocket connection
wscat -c wss://localhost:5001/agentHub \
  -H "Authorization: Bearer cct_your_token"
```

## Development

### Run Tests

```bash
dotnet test
```

### Debug

```bash
cd src/CoorChat.RelayServer.Api
dotnet watch run
```

### Generate Token

```bash
# Using MCP server CLI
cd ../mcp-server
npm run cli -- token generate --type channel
```

## Architecture

```
┌─────────────┐
│   Clients   │ (TypeScript/C# agents)
└──────┬──────┘
       │ WebSocket/SSE
       ▼
┌─────────────────────────────┐
│      AgentHub (SignalR)     │
├─────────────────────────────┤
│  - RegisterAgent            │
│  - SendMessage              │
│  - SendMessageToAgent       │
│  - Heartbeat                │
│  - GetConnectedAgents       │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│    ConnectionManager        │
├─────────────────────────────┤
│  - Thread-safe dictionary   │
│  - Connection tracking      │
│  - Activity monitoring      │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│   AuthenticationService     │
├─────────────────────────────┤
│  - Token validation         │
│  - Timing-safe comparison   │
│  - SHA-256 hashing          │
└─────────────────────────────┘
```

## License

MIT - See [LICENSE](../../LICENSE)

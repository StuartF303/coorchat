# CoorChat Quick Start Script (PowerShell)
# Automates local installation and setup

$ErrorActionPreference = "Stop"

Write-Host "🚀 CoorChat Quick Start" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm not found. Please install npm" -ForegroundColor Red
    exit 1
}

$dockerAvailable = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $dockerAvailable = $true
} else {
    Write-Host "⚠️  Docker not found. You'll need to install Redis manually." -ForegroundColor Yellow
}

Write-Host "✅ Prerequisites checked" -ForegroundColor Green
Write-Host ""

# Navigate to MCP server
Set-Location packages\mcp-server

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install
Write-Host "✅ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Build project
Write-Host "🔨 Building project..." -ForegroundColor Yellow
npm run build
Write-Host "✅ Project built" -ForegroundColor Green
Write-Host ""

# Generate secure token
Write-Host "🔑 Generating secure token..." -ForegroundColor Yellow
$TOKEN = node -e "console.log('cct_' + require('crypto').randomBytes(32).toString('hex'))"
Write-Host "✅ Token generated" -ForegroundColor Green
Write-Host ""
Write-Host "Your secure token: " -NoNewline
Write-Host $TOKEN -ForegroundColor Yellow
Write-Host "⚠️  Save this token! You'll need it for all agents." -ForegroundColor Yellow
Write-Host ""

# Save token to .env file
$envContent = @"
# CoorChat Configuration
# Generated: $(Get-Date)

# Shared authentication token (use same token for all agents)
SHARED_TOKEN=$TOKEN

# Channel configuration (redis, discord, or signalr)
CHANNEL_TYPE=redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Agent configuration
AGENT_ID=agent-claude-1
AGENT_ROLE=developer

# Optional: GitHub integration
# GITHUB_TOKEN=ghp_your_token_here
# GITHUB_OWNER=your-org
# GITHUB_REPO=your-repo

# Logging
LOG_LEVEL=info
"@

Set-Content -Path ".env" -Value $envContent
Write-Host "✅ Configuration saved to .env" -ForegroundColor Green
Write-Host ""

# Setup channel
Write-Host "📡 Setting up communication channel..." -ForegroundColor Yellow
Write-Host "Choose your channel type:"
Write-Host "  1) Redis (Recommended - requires Docker)"
Write-Host "  2) Discord (Easy - requires Discord bot)"
Write-Host "  3) SignalR (Advanced - requires relay server)"
Write-Host ""
$channelChoice = Read-Host "Enter choice [1-3]"

switch ($channelChoice) {
    "1" {
        if ($dockerAvailable) {
            Write-Host "Starting Redis container..." -ForegroundColor Yellow
            try {
                docker run -d --name coorchat-redis -p 6379:6379 redis:7-alpine 2>$null
            } catch {
                Write-Host "Redis container already exists, starting it..." -ForegroundColor Yellow
                docker start coorchat-redis
            }
            Write-Host "✅ Redis started on localhost:6379" -ForegroundColor Green
        } else {
            Write-Host "❌ Docker not available. Please install Docker or choose another channel." -ForegroundColor Red
            exit 1
        }
    }
    "2" {
        Write-Host ""
        Write-Host "Discord Setup Instructions:" -ForegroundColor Cyan
        Write-Host "1. Go to https://discord.com/developers/applications"
        Write-Host "2. Create a new application"
        Write-Host "3. Go to 'Bot' → 'Add Bot'"
        Write-Host "4. Copy the bot token"
        Write-Host "5. Enable 'Message Content Intent'"
        Write-Host "6. Invite bot to your server"
        Write-Host "7. Create a channel and copy its ID"
        Write-Host ""
        $discordToken = Read-Host "Enter Discord bot token"
        $channelId = Read-Host "Enter Discord channel ID"

        # Update .env
        $envContent = $envContent -replace "CHANNEL_TYPE=redis", "CHANNEL_TYPE=discord"
        $envContent += "`nDISCORD_BOT_TOKEN=$discordToken"
        $envContent += "`nDISCORD_CHANNEL_ID=$channelId"
        Set-Content -Path ".env" -Value $envContent
        Write-Host "✅ Discord configured" -ForegroundColor Green
    }
    "3" {
        Write-Host "Starting SignalR relay server..." -ForegroundColor Yellow
        Set-Location ..\..\packages\relay-server
        docker build -t coorchat-relay .
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Failed to build relay server" -ForegroundColor Red
            exit 1
        }
        docker run -d --name coorchat-relay -p 5001:5001 -e "Authentication__SharedToken=$TOKEN" coorchat-relay
        Set-Location ..\..\packages\mcp-server

        # Update .env
        $envContent = $envContent -replace "CHANNEL_TYPE=redis", "CHANNEL_TYPE=signalr"
        $envContent += "`nSIGNALR_HUB_URL=https://localhost:5001/agentHub"
        Set-Content -Path ".env" -Value $envContent
        Write-Host "✅ SignalR relay server started" -ForegroundColor Green
    }
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Run tests
Write-Host "🧪 Running tests..." -ForegroundColor Yellow
npm test -- --run
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Some tests failed, but installation is complete" -ForegroundColor Yellow
}
Write-Host ""

# Generate Claude Desktop config
Write-Host "📝 Generating Claude Desktop configuration..." -ForegroundColor Yellow

$repoPath = (Get-Location).Path | Split-Path -Parent | Split-Path -Parent
$mcpServerPath = Join-Path $repoPath "packages\mcp-server\dist\index.js"
$mcpServerPath = $mcpServerPath -replace "\\", "\\"

$claudeConfig = @"
{
  "mcpServers": {
    "coorchat": {
      "command": "node",
      "args": [
        "$mcpServerPath"
      ],
      "env": {
        "CHANNEL_TYPE": "redis",
        "REDIS_HOST": "localhost",
        "REDIS_PORT": "6379",
        "SHARED_TOKEN": "$TOKEN",
        "AGENT_ID": "agent-claude-1",
        "AGENT_ROLE": "developer",
        "LOG_LEVEL": "info"
      }
    }
  }
}
"@

Set-Content -Path "claude_desktop_config.json" -Value $claudeConfig
Write-Host "✅ Claude Desktop config generated" -ForegroundColor Green
Write-Host ""

# Installation complete
Write-Host "🎉 Installation Complete!" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Copy the Claude Desktop configuration to:"
$claudeConfigPath = "$env:APPDATA\Claude\claude_desktop_config.json"
Write-Host "   $claudeConfigPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Configuration file created at:"
Write-Host "   .\claude_desktop_config.json" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Restart Claude Desktop"
Write-Host ""
Write-Host "3. Test the MCP server in Claude:"
Write-Host "   Ask: 'Can you check if coorchat is connected?'"
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Start agents manually:"
Write-Host "    npm run cli -- agent start --role developer" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Monitor coordination:"
Write-Host "    npm run cli -- monitor" -ForegroundColor Yellow
Write-Host ""
Write-Host "  View logs:"
Write-Host "    npm run cli -- logs" -ForegroundColor Yellow
Write-Host ""
Write-Host "Happy coordinating! 🤖" -ForegroundColor Green

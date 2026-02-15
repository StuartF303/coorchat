#!/bin/bash
# CoorChat Quick Start Script
# Automates local installation and setup

set -e  # Exit on error

echo "🚀 CoorChat Quick Start"
echo "======================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install npm${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker not found. You'll need to install Redis manually.${NC}"
    DOCKER_AVAILABLE=false
else
    DOCKER_AVAILABLE=true
fi

echo -e "${GREEN}✅ Prerequisites checked${NC}"
echo ""

# Navigate to MCP server
cd packages/mcp-server

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Build project
echo "🔨 Building project..."
npm run build
echo -e "${GREEN}✅ Project built${NC}"
echo ""

# Generate secure token
echo "🔑 Generating secure token..."
TOKEN=$(node -e "console.log('cct_' + require('crypto').randomBytes(32).toString('hex'))")
echo -e "${GREEN}✅ Token generated${NC}"
echo ""
echo -e "${BLUE}Your secure token: ${YELLOW}${TOKEN}${NC}"
echo -e "${YELLOW}⚠️  Save this token! You'll need it for all agents.${NC}"
echo ""

# Save token to .env file
cat > .env << EOF
# CoorChat Configuration
# Generated: $(date)

# Shared authentication token (use same token for all agents)
SHARED_TOKEN=${TOKEN}

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
EOF

echo -e "${GREEN}✅ Configuration saved to .env${NC}"
echo ""

# Setup channel
echo "📡 Setting up communication channel..."
echo "Choose your channel type:"
echo "  1) Redis (Recommended - requires Docker)"
echo "  2) Discord (Easy - requires Discord bot)"
echo "  3) SignalR (Advanced - requires relay server)"
echo ""
read -p "Enter choice [1-3]: " channel_choice

case $channel_choice in
    1)
        if [ "$DOCKER_AVAILABLE" = true ]; then
            echo "Starting Redis container..."
            docker run -d --name coorchat-redis -p 6379:6379 redis:7-alpine 2>/dev/null || {
                echo -e "${YELLOW}Redis container already exists, starting it...${NC}"
                docker start coorchat-redis
            }
            echo -e "${GREEN}✅ Redis started on localhost:6379${NC}"
        else
            echo -e "${RED}❌ Docker not available. Please install Docker or choose another channel.${NC}"
            exit 1
        fi
        ;;
    2)
        echo ""
        echo "Discord Setup Instructions:"
        echo "1. Go to https://discord.com/developers/applications"
        echo "2. Create a new application"
        echo "3. Go to 'Bot' → 'Add Bot'"
        echo "4. Copy the bot token"
        echo "5. Enable 'Message Content Intent'"
        echo "6. Invite bot to your server"
        echo "7. Create a channel and copy its ID"
        echo ""
        read -p "Enter Discord bot token: " discord_token
        read -p "Enter Discord channel ID: " channel_id

        # Update .env
        sed -i "s/CHANNEL_TYPE=redis/CHANNEL_TYPE=discord/" .env
        echo "DISCORD_BOT_TOKEN=${discord_token}" >> .env
        echo "DISCORD_CHANNEL_ID=${channel_id}" >> .env
        echo -e "${GREEN}✅ Discord configured${NC}"
        ;;
    3)
        echo "Starting SignalR relay server..."
        cd ../../packages/relay-server
        docker build -t coorchat-relay . || {
            echo -e "${RED}❌ Failed to build relay server${NC}"
            exit 1
        }
        docker run -d --name coorchat-relay -p 5001:5001 \
            -e "Authentication__SharedToken=${TOKEN}" \
            coorchat-relay
        cd ../../packages/mcp-server

        # Update .env
        sed -i "s/CHANNEL_TYPE=redis/CHANNEL_TYPE=signalr/" .env
        echo "SIGNALR_HUB_URL=https://localhost:5001/agentHub" >> .env
        echo -e "${GREEN}✅ SignalR relay server started${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""

# Run tests
echo "🧪 Running tests..."
npm test -- --run || {
    echo -e "${YELLOW}⚠️  Some tests failed, but installation is complete${NC}"
}
echo ""

# Generate Claude Desktop config
echo "📝 Generating Claude Desktop configuration..."

REPO_PATH=$(cd ../.. && pwd)
MCP_SERVER_PATH="${REPO_PATH}/packages/mcp-server/dist/index.js"

cat > claude_desktop_config.json << EOF
{
  "mcpServers": {
    "coorchat": {
      "command": "node",
      "args": [
        "${MCP_SERVER_PATH}"
      ],
      "env": {
        "CHANNEL_TYPE": "redis",
        "REDIS_HOST": "localhost",
        "REDIS_PORT": "6379",
        "SHARED_TOKEN": "${TOKEN}",
        "AGENT_ID": "agent-claude-1",
        "AGENT_ROLE": "developer",
        "LOG_LEVEL": "info"
      }
    }
  }
}
EOF

echo -e "${GREEN}✅ Claude Desktop config generated${NC}"
echo ""

# Installation complete
echo "🎉 Installation Complete!"
echo "======================="
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "1. Copy the Claude Desktop configuration:"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    CLAUDE_CONFIG_PATH="%APPDATA%\\Claude\\claude_desktop_config.json"
else
    CLAUDE_CONFIG_PATH="~/.claude/claude_desktop_config.json"
fi
echo -e "   ${YELLOW}${CLAUDE_CONFIG_PATH}${NC}"
echo ""
echo "   Configuration file created at:"
echo -e "   ${YELLOW}./claude_desktop_config.json${NC}"
echo ""
echo "2. Restart Claude Desktop"
echo ""
echo "3. Test the MCP server in Claude:"
echo "   Ask: 'Can you check if coorchat is connected?'"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo ""
echo "  Start agents manually:"
echo -e "    ${YELLOW}npm run cli -- agent start --role developer${NC}"
echo ""
echo "  Monitor coordination:"
echo -e "    ${YELLOW}npm run cli -- monitor${NC}"
echo ""
echo "  View logs:"
echo -e "    ${YELLOW}npm run cli -- logs${NC}"
echo ""
echo -e "${GREEN}Happy coordinating! 🤖${NC}"

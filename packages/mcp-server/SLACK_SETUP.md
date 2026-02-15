# Slack Setup Guide for CoorChat

This guide walks you through setting up a Slack app for CoorChat agent coordination.

## Prerequisites

- A Slack workspace where you have permission to install apps
- Node.js 18+ installed
- CoorChat MCP Server repository cloned

## Step 1: Create a Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"**
3. Select **"From scratch"**
4. Enter:
   - **App Name**: `CoorChat Agent` (or your preferred name)
   - **Workspace**: Select your workspace
5. Click **"Create App"**

## Step 2: Configure Bot Permissions

1. In the left sidebar, click **"OAuth & Permissions"**
2. Scroll to **"Scopes" > "Bot Token Scopes"**
3. Click **"Add an OAuth Scope"** and add:
   - `channels:history` - View messages in public channels
   - `channels:read` - View basic info about public channels
   - `chat:write` - Send messages as bot
   - `chat:write.public` - Send messages to channels bot isn't in

## Step 3: Install App to Workspace

1. Scroll to top of **"OAuth & Permissions"** page
2. Click **"Install to Workspace"**
3. Review permissions and click **"Allow"**
4. **Copy the "Bot User OAuth Token"** (starts with `xoxb-`)
   - Save this for later - it's your `SLACK_BOT_TOKEN`

## Step 4: Enable Socket Mode

1. In the left sidebar, click **"Socket Mode"**
2. Toggle **"Enable Socket Mode"** to **ON**
3. Click **"Generate an app-level token to enable Socket Mode"**
4. In the popup:
   - **Token Name**: `CoorChat Socket`
   - **Scopes**: Select `connections:write`
5. Click **"Generate"**
6. **Copy the token** (starts with `xapp-`)
   - Save this for later - it's your `SLACK_APP_TOKEN`
7. Click **"Done"**

## Step 5: Subscribe to Events

1. In the left sidebar, click **"Event Subscriptions"**
2. Toggle **"Enable Events"** to **ON**
3. Under **"Subscribe to bot events"**, click **"Add Bot User Event"**
4. Add the following event:
   - `message.channels` - A message was posted to a channel
5. Click **"Save Changes"** at bottom

## Step 6: Get Your Channel ID

1. Open Slack (desktop or web app)
2. Navigate to the channel you want to use for agent coordination
3. Right-click the channel name
4. Select **"View channel details"**
5. Scroll down to find the **Channel ID** (starts with `C`)
6. Click to copy it
   - Save this - it's your `SLACK_CHANNEL_ID`

## Step 7: Get Your Team/Workspace ID (Optional)

1. Look at your Slack workspace URL in browser:
   - Format: `https://app.slack.com/client/[TEAM_ID]/...`
2. The `TEAM_ID` starts with `T`
3. Copy this - it's your `SLACK_TEAM_ID`

## Step 8: Invite Bot to Channel

1. In Slack, go to your chosen channel
2. Type: `/invite @YourBotName`
   - Or right-click channel → **"Integrations"** → **"Add apps"** → select your bot

## Step 9: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cd packages/mcp-server
   cp .env.example .env
   ```

2. Edit `.env` and fill in your values:
   ```bash
   SLACK_BOT_TOKEN=xoxb-your-actual-bot-token-here
   SLACK_APP_TOKEN=xapp-your-actual-app-token-here
   SLACK_CHANNEL_ID=C01234567890
   SLACK_TEAM_ID=T01234567890
   ```

## Step 10: Run the Server

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Start in development mode:
   ```bash
   npm run dev
   ```

   Or production mode:
   ```bash
   npm start
   ```

## Testing the Connection

Once the server is running, you should see:
```
✅ Slack bot authenticated
✅ Connected to Slack channel
```

Test by sending a message in your Slack channel:
```json
{
  "protocolVersion": "1.0",
  "messageType": "heartbeat",
  "senderId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-02-15T12:00:00.000Z",
  "priority": 5
}
```

## Troubleshooting

### "Missing required parameter: token"
- Make sure `SLACK_BOT_TOKEN` is set correctly in `.env`
- Verify the token starts with `xoxb-`

### "Invalid auth" or "not_authed"
- Token may be expired or revoked
- Regenerate token in Slack app settings

### "Channel not found"
- Verify `SLACK_CHANNEL_ID` is correct
- Make sure bot is invited to the channel

### Bot doesn't receive messages
- Check Event Subscriptions are enabled
- Verify `message.channels` event is subscribed
- Make sure Socket Mode is enabled

### Connection timeouts
- Check your firewall/network settings
- Socket Mode requires outbound HTTPS connections

## Additional Resources

- [Slack API Documentation](https://api.slack.com/docs)
- [Socket Mode Guide](https://api.slack.com/apis/connections/socket)
- [Event Types Reference](https://api.slack.com/events)
- [OAuth Scopes Reference](https://api.slack.com/scopes)

## Security Notes

- Never commit `.env` file to version control
- Rotate tokens regularly
- Use workspace-level tokens only (not user tokens)
- Limit bot permissions to minimum required scopes
- Monitor bot activity in Slack App Settings > Event Logs

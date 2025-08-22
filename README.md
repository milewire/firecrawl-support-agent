[![CI](https://github.com/milewire/firecrawl-support-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/milewire/firecrawl-support-agent/actions/workflows/ci.yml)

# Firecrawl Support Agent

A powerful Discord bot that integrates with GitHub, Supabase, and OpenAI to provide intelligent support ticket management and automated customer assistance.

## 🚀 Features

- **AI-Powered Support**: Uses OpenAI GPT-4o-mini to provide intelligent responses to user queries
- **Automatic Ticket Triage**: Automatically categorizes and prioritizes support tickets
- **GitHub Integration**: Creates and manages GitHub issues for support tickets
- **Supabase Database**: Stores ticket data and user interactions with vector search capabilities
- **Discord Slash Commands**: Easy-to-use slash commands for ticket management
- **Smart Sanitization**: Automatically redacts sensitive information from tickets
- **Vector Search**: Semantic search through documentation using embeddings

## 📋 Prerequisites

- Node.js 18+ 
- Discord Bot Token
- OpenAI API Key
- Supabase Project
- GitHub Personal Access Token

## 🛠️ Installation

### Quick Start
```bash
# Clone the repository
git clone https://github.com/milewire/firecrawl-support-agent.git
cd firecrawl-support-agent

# Install dependencies
npm install

# Set up environment variables (see Configuration section below)
# Create .env.local file with your actual values

# Deploy slash commands
npm run deploy

# Start the bot
npm start
```

### Detailed Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/milewire/firecrawl-support-agent.git
   cd firecrawl-support-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   # Discord Bot Configuration
   DISCORD_BOT_TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_client_id
   GUILD_ID=your_guild_id

   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key

   # Supabase Configuration
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_anon_key

   # GitHub Configuration
   GITHUB_TOKEN=your_github_personal_access_token
   GITHUB_REPO=your_github_repo_owner/repo_name
   ```

4. **Deploy slash commands**
   ```bash
   npm run deploy
   ```

5. **Start the bot**
   ```bash
   # Production
   npm start

   # Development (with auto-restart)
   npm run dev
   ```

## 🎮 Available Commands

### `/ping`
Check if the bot is online and responsive. Replies with "🏓 Pong!"

### `/help`
Display all available commands and their descriptions.

### `/status`
Shows system status. Replies with "✅ System is running smoothly!"

### `/doc`
Get a documentation link. Currently points to a placeholder URL.

### `/ask <question> [private]`
Ask the AI a support question using OpenAI GPT-4o-mini.
- **question** (required): Your support question
- **private** (optional): Set to true for private replies only visible to you

### `/triage <text>`
Classify text to determine category, severity, and whether human intervention is needed.
- **text** (required): Content to analyze and triage

### `/ticket <title> <description> [severity] [private]`
Create a GitHub issue with automatic triage and categorization.
- **title** (required): Issue title
- **description** (required): Describe the problem
- **severity** (optional): Override severity (low/medium/high/critical)
- **private** (optional): Set to true for private replies only visible to you

## 🔧 Configuration

### Discord Bot Setup
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section and create a bot
4. Copy the bot token to your `.env.local` file as `DISCORD_BOT_TOKEN`
5. Copy the Client ID to your `.env.local` file as `CLIENT_ID`
6. Copy your Guild ID to your `.env.local` file as `GUILD_ID`
7. Enable the necessary intents (Guilds)

### Supabase Setup
1. Create a new Supabase project
2. Set up the required tables:
   ```sql
   -- Tickets table for logging interactions
   CREATE TABLE tickets (
     id SERIAL PRIMARY KEY,
     user TEXT NOT NULL,
     source TEXT NOT NULL,
     message TEXT NOT NULL,
     reply TEXT,
     category TEXT,
     confidence FLOAT,
     created_at TIMESTAMP DEFAULT NOW()
   );

   -- For vector search (if using embeddings)
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Copy your project URL and API key to `.env.local`

### GitHub Integration
1. Create a GitHub Personal Access Token with repo permissions
2. Set the repository where issues should be created in `GITHUB_REPO`
3. Add the token to your `.env.local` file as `GITHUB_TOKEN`

## 📁 Project Structure

```
firecrawl-support-agent/
├── .github/           # GitHub workflows and templates
│   ├── workflows/     # CI/CD workflows
│   └── ISSUE_TEMPLATE/ # Issue templates
├── commands/          # Discord slash commands
│   ├── help.js       # Help command
│   ├── ping.js       # Ping command
│   ├── ticket.js     # Ticket creation command (placeholder)
│   └── docs.js       # Documentation lookup command (placeholder)
├── config/           # Configuration files
│   └── config.json   # Bot configuration
├── events/           # Discord event handlers
│   ├── ready.js      # Bot ready event
│   └── interactionCreate.js  # Command interaction handler
├── knowledge/        # Knowledge base
│   └── faqs.json     # Frequently asked questions
├── scripts/          # Utility scripts (empty)
├── .snapshots/       # Project snapshots
│   ├── sponsors.md   # Sponsorship information
│   ├── readme.md     # README snapshot
│   └── config.json   # Configuration snapshot
├── discord_bot.mjs   # Main bot file with all command logic
├── deploy-commands.mjs # Command deployment script
├── supabase.js       # Supabase client and database functions
├── github.mjs        # GitHub API integration
├── docs_ingest.js    # Documentation ingestion script
├── agent.js          # AI agent logic
├── test-env.js       # Environment testing utility
├── firecrawl_api.txt # API documentation reference
├── LICENSE           # ISC License
├── .gitignore        # Git ignore patterns
└── package.json      # Project dependencies
```

## 🔒 Security Features

- **Automatic Sanitization**: Sensitive information (emails, tokens, long URLs) is automatically redacted before sending to GitHub
- **Environment Variables**: All sensitive configuration is stored in environment variables
- **Input Validation**: All user inputs are validated and sanitized
- **Private Replies**: Commands support private replies to keep sensitive information hidden
- **Error Handling**: Comprehensive error handling with user-friendly messages

## 🤖 AI Features

### Automatic Ticket Triage
The bot automatically analyzes support tickets and:
- **Categorizes** them (bug, question, billing, feature_request, usage, other)
- **Assigns severity** levels (low, medium, high, critical)
- **Determines** if human intervention is needed
- **Suggests** appropriate responses

### Intelligent Responses
- Uses OpenAI GPT-4o-mini for natural language understanding
- Provides context-aware responses with 400 token limit
- Handles complex queries with 15-second timeout
- Maintains conversation history and context

### Vector Search (Coming Soon)
- Semantic search through documentation using embeddings
- Supabase vector similarity search integration
- Automatic documentation retrieval for relevant answers

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Environment Variables Reference
| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_BOT_TOKEN` | Discord bot token | ✅ |
| `CLIENT_ID` | Discord application client ID | ✅ |
| `GUILD_ID` | Discord guild/server ID | ✅ |
| `OPENAI_API_KEY` | OpenAI API key | ✅ |
| `SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_KEY` | Supabase anon key | ✅ |
| `GITHUB_TOKEN` | GitHub personal access token | ✅ |
| `GITHUB_REPO` | GitHub repository (owner/repo) | ✅ |

## 📝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
4. **Make your changes** and commit them (`git commit -m 'Add amazing feature'`)
5. **Push to your fork** (`git push origin feature/amazing-feature`)
6. **Open a Pull Request** against the main repository

### Development Workflow
```bash
# Keep your fork up to date
git fetch upstream
git checkout main
git merge upstream/main
git push origin main

# Create a new feature branch
git checkout -b feature/your-feature-name
# Make changes, commit, and push
git push origin feature/your-feature-name
```

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

If you encounter any issues or have questions:
- Check the [Issues](https://github.com/milewire/firecrawl-support-agent/issues) page
- Create a new issue with detailed information
- Contact the development team

## 🔄 Updates

Stay updated with the latest features and bug fixes by:
- [Watching the repository](https://github.com/milewire/firecrawl-support-agent)
- Checking the [releases page](https://github.com/milewire/firecrawl-support-agent/releases)
- Following the changelog

## 📊 Project Status

- ✅ **Core Features**: Discord bot with slash commands
- ✅ **AI Integration**: OpenAI GPT-4o-mini integration
- ✅ **GitHub Integration**: Automatic issue creation
- ✅ **Supabase Integration**: Database storage
- ✅ **Security**: Input sanitization and environment variables
- ✅ **License**: ISC License included
- ✅ **GitHub Setup**: Workflows and issue templates
- 🔄 **Vector Search**: In development
- 🔄 **Documentation**: In progress

---

**Note**: Make sure to keep your API keys and tokens secure and never commit them to version control. The `.env.local` file is already included in `.gitignore` for your protection.

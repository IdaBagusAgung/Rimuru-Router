# 🌀 RIMURU — High-Performance AI Gateway & Proxy Router

<p align="center">
  <img src="https://img.shields.io/badge/Bun-1.4.0%2B-black?style=for-the-badge&logo=bun&logoColor=white" alt="Bun">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Elysia-Framework-purple?style=for-the-badge" alt="Elysia">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/License-GPL--3.0-green?style=for-the-badge" alt="GPL 3.0">
</p>

> **RIMURU Router** is a high-speed, self-hosted multi-provider AI proxy and delivery engine. It unifies OpenAI, Anthropic, and custom upstream providers (like CodeBuddy) behind a resilient gateway with intelligent round-robin load balancing, auto-failover, model aliasing, and full live telemetry.

Point **Claude Code**, **Cline**, **Cursor**, **Codex**, or any standard AI client directly to RIMURU. The client speaks its native protocol while RIMURU manages authentication, token quotas, cooldowns, and wire-level protocol translations.

---

## ⚡ Key Features

- **Dual-Protocol Compatibility**: Supports both **Anthropic Messages API** (`/v1/messages`) and **OpenAI Chat Completions** (`/v1/chat/completions`) simultaneously.
- **Great Sage Delivery Engine**:
  - Multi-account rotation with intelligent round-robin and health-aware routing.
  - Automatic cooldown detection and seamless failover to fallback models.
  - Dynamic model aliasing (e.g. `claude-3-5-sonnet` -> `cb/claude-sonnet-4.6`, `deepseek-v4.1-flash(max)`).
- **Client Integration Ready**: Plug-and-play with Claude Code CLI, Cursor, Cline, VS Code extensions, OpenCode, and any OpenAI/Anthropic SDK.
- **Streaming & Token Caching**: Real-time server-sent events (SSE) streaming and prompt caching translation with zero added latency.
- **Interactive Web Dashboard**: Built-in modern React + Vite console for monitoring request traces, token usage, quotas, active keys, and routing rules.
- **Flexible Storage Architecture**:
  - **Lite Mode**: Embedded SQLite, single process, zero setup.
  - **Full Mode**: External PostgreSQL + Redis for multi-instance high-concurrency clusters.

---

## 🚀 Quick Start with Docker (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/IdaBagusAgung/Rimuru-Router.git
   cd Rimuru-Router
   ```

2. **Configure your environment:**
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to set your encryption key, admin credentials, and upstream tokens.*

3. **Launch RIMURU Gateway:**
   ```bash
   docker compose up -d --build
   ```
   The gateway will be accessible at:
   - **Gateway Proxy**: `http://localhost:3888` (or `http://localhost:12800`)
   - **Web Dashboard**: `http://localhost:3888` (Default login: configured admin credentials)

---

## 💻 Local Development (Bun)

Prerequisites: **Bun >= 1.4.0** and **Node.js**.

```bash
# 1. Install dependencies
bun install

# 2. Interactive setup
bun setup

# 3. Start development stack (Backend + Dashboard)
bun run dev
```

---

## 🛠️ Client Configuration

### 1. Claude Code CLI

Add or update your `~/.claude/settings.json` (on Windows: `C:\Users\<User>\.claude\settings.json`):

```json
{
  "env": {
    "ANTHROPIC_API_KEY": "your-rimuru-api-key",
    "ANTHROPIC_BASE_URL": "http://localhost:3888"
  },
  "model": "cb/deepseek-v4.1-flash(max)",
  "permissions": {
    "defaultMode": "bypassPermissions"
  },
  "skipDangerousModePermissionPrompt": true,
  "autoUpdatesChannel": "latest",
  "theme": "dark"
}
```

> **Tip:** Set `"permissions": { "defaultMode": "bypassPermissions" }` to enable autonomous execution without interactive tool approvals.

Test connection from your terminal:
```bash
claude -p "Hello RIMURU, connection test"
```

---

### 2. Cursor / Cline / Roo Code / OpenAI SDK

Configure your client to point to RIMURU's OpenAI endpoint:

- **Base URL**: `http://localhost:3888/v1`
- **API Key**: `your-rimuru-api-key`
- **Model**: `claude-3-5-sonnet`, `claude-3-7-sonnet`, `deepseek-v4.1-flash`, or `auto`

#### Example using `curl`:
```bash
curl http://localhost:3888/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-rimuru-api-key" \
  -d '{
    "model": "cb/deepseek-v4.1-flash",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## 📡 API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/v1/messages` | `POST` | Anthropic Messages API (Claude Code, Cline) |
| `/v1/chat/completions` | `POST` | OpenAI Chat Completions API |
| `/v1/models` | `GET` | List all available upstream models & aliases |
| `/v1/responses` | `POST` | OpenAI Responses API format |
| `/v1/responses/compact` | `POST` | Context window compaction |
| `/v1/search` | `POST` | Live Web Search integration |
| `/health` | `GET` | Gateway healthcheck |

---

## ⚙️ Environment Configuration

Key configuration parameters (set in `.env` or Docker environment):

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port inside container | `12800` |
| `CARTETHYIA_DB_MODE` | Database mode (`lite` for SQLite, `full` for PostgreSQL) | `lite` |
| `CARTETHYIA_ENCRYPTION_KEY` | 32-byte hex key for encrypting provider tokens in DB | *Generated on setup* |
| `RIMURU_API_KEY` | Default root API key for proxy requests | `sk-rimuru-tempest` |
| `RIMURU_ADMIN_USERNAME` | Console admin username | `admin` |
| `RIMURU_ADMIN_PASSWORD` | Console admin password | *Required* |
| `REDIS_URL` | Redis URL for coordination (optional in Lite mode) | `redis://redis:6379` |

---

## 🛡️ Security & Privacy

- **Local & Self-Hosted**: All request routing and data storage stay on your machine or private infrastructure.
- **Zero Telemetry Leaks**: RIMURU contains no tracking, external analytics, or covert telemetry exfiltration.
- **Encrypted Credential Storage**: Provider tokens and OAuth secrets are encrypted at rest with AES-GCM using your private `CARTETHYIA_ENCRYPTION_KEY`.
- **Sensitive Isolation**: Configuration keys, local logs, and accounts are automatically ignored by `.gitignore`.

---

## 📜 License

Distributed under the **GNU General Public License v3.0 (GPL-3.0)**. See [LICENSE](LICENSE) for details.
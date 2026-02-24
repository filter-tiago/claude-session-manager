# Claude Session Manager

Desktop app for tracking and managing multiple [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) sessions across tmux panes.

If you run multiple Claude Code sessions simultaneously (in tmux, terminals, or across projects), this app gives you a single dashboard to see what each session is doing, search through conversations, and spawn new sessions.

## Features

- **Auto-detection** — Watches `~/.claude/projects/` and indexes session JSONL files in real time
- **Session grid** — See all sessions at a glance with status (active/idle/completed), project name, and detected task
- **Conversation viewer** — Read the full conversation of any session, including tool calls
- **Full-text search** — Search across all session content
- **tmux integration** — Detects and displays tmux session/pane mappings
- **Spawn sessions** — Launch new Claude CLI sessions from the app

## Requirements

- **macOS** or **Linux** (tmux features are platform-specific)
- **Node.js** 20+
- **tmux** (optional, for tmux integration)
- **Claude CLI** installed with sessions in `~/.claude/projects/`

## Setup

```bash
# Install dependencies
npm install

# Rebuild native modules for Electron
npx electron-rebuild

# Start development
npm run dev
```

> `npx electron-rebuild` is required because `better-sqlite3` is a native Node module that needs to be compiled for Electron's version of Node.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (renderer only) |
| `npm run electron:dev` | Start full Electron app in dev mode |
| `npm run build` | Type-check and build for production |
| `npm run package` | Build and package as macOS .dmg/.zip |
| `npm run lint` | Run ESLint |

## Architecture

```
electron/
  main.ts              # Main process, IPC handlers, window management
  preload.cjs          # Context bridge (native CJS, not bundled)
  services/
    session-indexer.ts  # JSONL file watcher and parser
    database.ts         # SQLite storage and queries
    auto-detector.ts    # Session auto-detection
    tmux-mapper.ts      # tmux pane discovery
src/
  App.tsx              # React app entry
  components/          # UI components (SessionGrid, ConversationViewer, etc.)
  hooks/               # React hooks (useSessions, useSession)
  stores/              # Zustand state management
  types/               # TypeScript type definitions
```

**Key technical decisions:**
- **Electron 33** — Later versions have renderer issues
- **Preload must be native CJS** — Vite ESM bundling breaks Electron's context isolation
- **better-sqlite3** — Requires `npx electron-rebuild` after install or version changes
- **Zustand** for state management
- **Tailwind CSS v4** for styling

## How It Works

1. The main process watches `~/.claude/projects/` for JSONL session files using chokidar
2. Each JSONL file is stream-parsed to extract messages, tool calls, and metadata
3. Parsed data is stored in a local SQLite database for fast querying
4. The renderer process displays sessions and subscribes to real-time updates via IPC
5. tmux integration maps Claude CLI processes to their tmux panes

## License

[MIT](LICENSE)

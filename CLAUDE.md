# Claude Session Manager

Electron desktop app for managing multiple Claude CLI sessions across tmux.

## Quick Commands

```bash
npm run dev          # Start Electron + Vite dev mode
npm run build        # Build production
npm run package      # Package as .dmg/.app
```

## Key Files

| File | Purpose |
|------|---------|
| `electron/main.ts` | Main process, IPC handlers |
| `electron/preload.cjs` | Context bridge (MUST be CJS) |
| `src/App.tsx` | React app entry |
| `electron/services/` | Backend services |

## Technical Constraints

- **Electron 33** - v40 has renderer issues
- **Preload must be native CJS** - Vite ESM breaks context isolation
- **better-sqlite3** - Requires `npx electron-rebuild` after version changes

## Project Structure

```
electron/
  main.ts           # Main process
  preload.cjs       # Preload script (native CJS!)
  services/
    session-indexer.ts
    auto-detector.ts
    tmux-mapper.ts
src/
  App.tsx           # React app
  components/       # UI components
  hooks/            # React hooks
  stores/           # Zustand stores
```

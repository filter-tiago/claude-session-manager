---
date: 2026-01-30T00:28:48+0000
session_name: command-center-v3
researcher: claude
git_commit: 198a2e2
branch: main
repository: claude-session-manager
topic: "Embedded Mini Tmux Terminals Implementation"
tags: [implementation, terminals, xterm, tmux, electron, ipc]
status: complete
last_updated: 2026-01-29
last_updated_by: claude
type: implementation_strategy
root_span_id: ""
turn_span_id: ""
---

# Handoff: Embedded Mini Tmux Terminals - State Sync & Streaming Issues

## Task(s)

| Task | Status |
|------|--------|
| Phase 1: Terminal Tile Grid (MiniTerminal, TerminalTileHeader, TerminalGrid) | Completed |
| Phase 2: Connection Pool (useTerminalPool, useTmuxPaneSnapshot, capturePaneSnapshot IPC) | Completed |
| Phase 3: Focus Mode (TerminalFocusOverlay with full keyboard input) | Completed |
| Phase 4: Store + Layout Presets (terminalGridStore, column selector, view toggle, filters) | Completed |
| Phase 5: Build Verification | Completed (builds clean) |
| **BUG: Pause/Connect button state is reversed in some cases** | **Partially fixed, still broken** |
| **BUG: Terminal output not streaming to mini tiles** | **Not investigated** |

The full implementation plan was provided inline by the user (not in a plan file). All 5 phases were implemented across 15 files. Build passes. However, two runtime bugs remain that prevent the feature from being usable.

## Critical References

- `thoughts/ledgers/CONTINUITY_CLAUDE-command-center-v3.md` - v3 ledger
- `src/components/TerminalViewer.tsx` - The WORKING existing terminal component (reference implementation)
- `electron/services/pty-manager.ts` - PTY connection management and tmux monitoring script

## Recent changes

All files are uncommitted on `main` branch. Key changes:

**New files created:**
- `src/components/MiniTerminal.tsx` - xterm.js tile (fontSize:10, read-only, 500-line scrollback)
- `src/components/TerminalTileHeader.tsx` - 28px compact header with status dot, Pause/Connect text buttons
- `src/components/TerminalGrid.tsx` - CSS Grid container with configurable columns
- `src/components/modals/TerminalFocusOverlay.tsx` - Full-screen overlay reusing TerminalViewer
- `src/hooks/useTerminalPool.ts` - Max 6 PTY connections with LRU eviction
- `src/hooks/useTmuxPaneSnapshot.ts` - One-shot pane capture for paused terminals
- `src/stores/terminalGridStore.ts` - Zustand store for grid state, connection tracking

**Modified files:**
- `electron/services/pty-manager.ts:426` - Added `capturePaneSnapshot()` function
- `electron/main.ts:1583-1599` - Added `get-active-pty-count` + `capture-pane-snapshot` IPC handlers
- `electron/preload.cjs:167-168` - Added `getActivePtyCount` + `capturePaneSnapshot` bridge methods
- `src/types/electron.d.ts:616-617` - Added type definitions for new IPC methods
- `src/pages/TmuxPage.tsx` - Full rewrite with terminal grid, card toggle, column selector, focus overlay
- `src/components/index.ts:16-18` - Added exports for new components
- `src/hooks/index.ts:10-11` - Added exports for new hooks
- `src/index.css:249-257` - Added `overlay-scale-in` animation keyframes

## Learnings

### 1. Pool state vs actual connection state desync (ROOT CAUSE OF REVERSED BUTTON)
Two separate state sources exist and can desync:
- **Pool/Zustand store** (`connectedPaneIds`): Tracks user INTENT (should be connected)
- **MiniTerminal internal** (`connectionState`): Tracks actual IPC REALITY (is connected)

When `pool.connect()` is called, it **immediately** registers in the Zustand store (`store.registerConnection`) BEFORE the IPC `terminalConnect` completes. If the IPC fails or the terminal exits, the store still says "connected" but the terminal is dead.

**Attempted fix**: Added `onConnectionLost` callback from MiniTerminal to parent, which calls `pool.disconnect()` when:
- `onTerminalExit` fires (terminal/pane dies)
- `terminalConnect` IPC returns `success: false`
- `terminalConnect` IPC throws

**User reports this fix is still not sufficient.** The state is still reversed in some cases.

### 2. Stale closure bug in output listener
Original code at `MiniTerminal.tsx:125`:
```
if (connectionState !== 'connected') setConnectionState('connected');
```
`connectionState` was captured from the render when the effect was created, never updated inside the listener. Fixed with `connectedRef` (a `useRef(false)`) to avoid stale closure.

### 3. xterm.js import paths
The existing `TerminalViewer.tsx` uses `xterm` (v4-style), NOT `@xterm/xterm` (v5-style). The agent initially created MiniTerminal with wrong imports. Must use:
- `import { Terminal } from 'xterm'`
- `import { FitAddon } from 'xterm-addon-fit'`
- `import 'xterm/css/xterm.css'`

### 4. TerminalViewer vs MiniTerminal architecture difference
TerminalViewer (working, existing) uses `sessionId` as the connection key and handles connect/disconnect internally. MiniTerminal uses `paneId` (format: `session:window.pane`) and defers connect/disconnect to the parent via props + pool. This indirection is where the state sync bugs live.

## Post-Mortem (Required for Artifact Index)

### What Worked
- Parallel agent spawning: 3 agents ran in parallel for backend IPC, frontend components, and hooks/store - completed all new files fast
- Build passes clean on first try after fixing xterm imports
- The TerminalFocusOverlay works well - reuses existing TerminalViewer as-is
- Zustand store pattern for grid state (columns, viewMode) is clean and matches existing patterns
- CSS Grid with configurable columns works perfectly

### What Failed
- Tried: Pool registers connection immediately in store before IPC completes → Failed because: creates window where store says "connected" but IPC hasn't finished or has failed
- Tried: `onConnectionLost` callback to sync pool on terminal exit/failure → Partially failed: user reports state is still reversed in some cases
- Not investigated: Whether terminal output is actually streaming to the mini tiles (user reports it's not)
- The MiniTerminal connection management is too complex compared to TerminalViewer's simpler internal model

### Key Decisions
- Decision: MiniTerminal is a SEPARATE component from TerminalViewer (not a wrapper)
  - Alternatives considered: Wrapping TerminalViewer with different defaults
  - Reason: Different needs (no keyboard input, smaller font, pool integration, compact header). But this created the two-state-source problem.
- Decision: Pool is renderer-side (Zustand store + hook), not in PTY manager
  - Reason: Keeps pty-manager simple, pool logic is UI concern
  - This may be the wrong call - the pool state can desync from backend state

## Artifacts

- `src/components/MiniTerminal.tsx` - Mini terminal tile component
- `src/components/TerminalTileHeader.tsx` - Tile header with Pause/Connect buttons
- `src/components/TerminalGrid.tsx` - CSS Grid container
- `src/components/modals/TerminalFocusOverlay.tsx` - Full-screen terminal overlay
- `src/hooks/useTerminalPool.ts` - Connection pool hook
- `src/hooks/useTmuxPaneSnapshot.ts` - Pane snapshot hook
- `src/stores/terminalGridStore.ts` - Grid state store
- `src/pages/TmuxPage.tsx` - Rewritten page integrating everything
- `electron/services/pty-manager.ts:426-445` - capturePaneSnapshot function
- `electron/main.ts:1583-1599` - New IPC handlers

## Action Items & Next Steps

### HIGH PRIORITY: Fix state sync bug (button state reversed)

**Investigation needed:**
1. **Compare to TerminalViewer's working pattern** at `src/components/TerminalViewer.tsx:112-180`. It manages connection state internally and works correctly. The key difference: TerminalViewer connects on mount and disconnects on unmount. MiniTerminal defers to parent via `isConnected` prop, creating the two-state-source problem.

2. **Consider simplifying**: Instead of the pool controlling `isConnected` via prop, have MiniTerminal manage its own connection lifecycle like TerminalViewer does. The pool would just track which panes SHOULD be connected (intent), and MiniTerminal would handle the actual IPC independently. The header button would use MiniTerminal's internal `connectionState` for display, not the pool's prop.

3. **Specific race condition to investigate**: When `onConnectionLost` fires, it calls `pool.disconnect()` which calls `terminalDisconnect` IPC. But the terminal already exited/failed -- so `terminalDisconnect` might error or no-op, and the pool's `unregisterConnection` might not fire if the disconnect throws. Check the error handling in `useTerminalPool.ts:17-24`.

### HIGH PRIORITY: Fix streaming (no terminal output in mini tiles)

**Investigation needed:**
1. **Check connection key mismatch**: MiniTerminal uses `paneId` format `session:window.pane` as the `sessionId` argument to `terminalConnect()`. But pty-manager may expect a different key format. Check `electron/services/pty-manager.ts:attachToPaneDirect()` for what it uses as the session key for `terminal-output` events.

2. **Check listener registration**: MiniTerminal registers `onTerminalOutput` filtering by `paneId`. If pty-manager emits output events with a different sessionId than what MiniTerminal expects, output will be silently dropped.

3. **Test manually**: In the Electron dev tools console, listen for `terminal-output` events and check what sessionId format they use vs what MiniTerminal passes to `terminalConnect`.

### LOWER PRIORITY
- Phase 5 features (command broadcast, status borders, keyboard nav) - not started
- Pool's `connectingRef` is never cleaned up after successful connection (only on disconnect). This may cause reconnection issues if you disconnect then reconnect the same pane.

## Other Notes

- The existing `TerminalViewer` at `src/components/TerminalViewer.tsx` is a working reference for how xterm.js + PTY IPC should work. It uses `sessionId` (Claude session ID) as the connection key, not tmux pane ID.
- PTY manager at `electron/services/pty-manager.ts` spawns a bash monitoring script that polls `tmux capture-pane` every 200ms. The session key for the active sessions Map is whatever `sessionId` is passed to `attachToPaneDirect()`.
- The tmux socket path is `/private/tmp/tmux-{uid}/default` (macOS).
- All changes are uncommitted on `main`. Only one prior commit exists: `198a2e2 Initial commit`.

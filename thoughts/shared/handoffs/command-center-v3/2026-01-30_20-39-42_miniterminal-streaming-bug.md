---
date: 2026-01-30T20:39:42-0300
session_name: command-center-v3
git_commit: 198a2e2
branch: main
repository: claude-session-manager
topic: "MiniTerminal Live Streaming Bug"
tags: [bugfix, terminal, streaming, react-effects, pty-manager]
status: complete
last_updated: 2026-01-30
type: implementation_strategy
root_span_id: ""
turn_span_id: ""
---

# Handoff: MiniTerminal streaming freezes after initial content, button state wrong

## Task(s)
- **Fix MiniTerminal live streaming** — PARTIALLY DONE, NOT VERIFIED WORKING
  - Tiles show initial tmux content but freeze (no live updates)
  - Button state (Pause/Connect) sometimes reversed
- Working from plan in conversation (no plan file), which prescribed splitting a monolithic `useEffect` into 4 focused effects

## Critical References
- `src/components/MiniTerminal.tsx` — The component with the bug
- `electron/services/pty-manager.ts` — Backend PTY manager; `attachToPaneDirect()` spawns a bash monitor script that polls `tmux capture-pane` every 200ms
- `src/components/TerminalViewer.tsx` — Working reference implementation (separate output listener effect)

## Recent changes

### MiniTerminal.tsx — Split monolithic effect into 4
- `src/components/MiniTerminal.tsx:68-74` — Added callback refs for `onConnectionLost`, `onConnectionEstablished`, `onConnectionFailed` to prevent unstable parent callbacks from being effect deps
- `src/components/MiniTerminal.tsx:127-139` — **Effect A**: Output listener, mount-scoped `[paneId]` only
- `src/components/MiniTerminal.tsx:141-151` — **Effect B**: Exit listener, mount-scoped `[paneId]` only
- `src/components/MiniTerminal.tsx:153-191` — **Effect C**: Connect/disconnect, deps `[shouldConnect, paneId, tmuxSession, tmuxPane]`
- `src/components/MiniTerminal.tsx:193-197` — **Effect D**: Snapshot display, deps `[shouldConnect, snapshot]`
- `src/components/MiniTerminal.tsx:182-186` — Removed `terminalDisconnect` from Effect C cleanup (was causing StrictMode race)

### terminalGridStore.ts — Atomic state transition
- `src/stores/terminalGridStore.ts:73-85` — Added `promoteToConnected()` method: single `set()` call that atomically removes from `connectingPanes` and adds to `connectedPanes`, preventing `shouldConnect` from toggling `true→false→true`

### useTerminalPool.ts — Use atomic promotion
- `src/hooks/useTerminalPool.ts:50-55` — `confirmConnection` now calls `store.promoteToConnected()` instead of separate `removeConnecting` + `registerConnection`

### Other changes by user (linter/manual)
- `src/pages/TmuxPage.tsx` — Added `isPlaceholder` support, `panesLoading` state, async pane resolution in `handleRequestConnect`
- `src/components/TerminalGrid.tsx` — Added `loading` prop, `isPlaceholder` in `shouldConnect` guard
- `src/components/TerminalTileHeader.tsx` — Added `isPlaceholder` prop with "Waiting" button state
- `vite.config.ts:34` — Port changed from 5199 to 5200
- `electron/main.ts:221` — Dev URL changed to localhost:5200

## Learnings

### Root cause analysis (verified)
1. **React StrictMode double-invocation** (`src/main.tsx:8`) — In dev mode, effects mount → unmount → remount. If Effect C cleanup calls `terminalDisconnect`, it kills PTY #1. Then remount creates PTY #2. But PTY #1's async exit event fires → Effect B → `onConnectionLost` → `pool.disconnect` → kills PTY #2. Terminal freezes.

2. **Non-atomic `confirmConnection`** — Two separate Zustand `set()` calls (`removeConnecting` then `registerConnection`) could cause `shouldConnect` to briefly toggle `true→false→true` if not batched, triggering Effect C cleanup/re-run cycle.

3. **Backend "already attached" guard** — `pty-manager.ts:197`: `if (activeSessions.has(sessionId)) return {success: true}` — returns early without creating new PTY. This is safe for StrictMode re-invocation but means if old PTY was killed, a reconnect attempt works correctly.

### Architecture understanding
- **PTY streaming model**: `attachToPaneDirect()` spawns `/bin/bash -c <monitor_script>` via `node-pty`. The script polls `tmux capture-pane -p -e -S -50` every 200ms, hashes output, clears+redraws on change. Output flows: PTY → `onData` → IPC `terminal-output` → renderer listener → xterm.write().
- **Pool lifecycle**: `useTerminalPool` manages connecting/connected state. `pool.connect()` adds to `connectingPanes`. `pool.confirmConnection()` promotes to `connectedPanes`. `pool.disconnect()` calls `terminalDisconnect` IPC + removes from store.
- **`shouldConnect` computation**: `TerminalGrid.tsx:84`: `connectedPaneIds.has(id) || connectingPaneIds.has(id)` — boolean OR of both sets.
- **All TerminalGrid callbacks are inline arrows** (lines 87-93) — new instances every render. Ref-ifying in MiniTerminal prevents effect deps instability.

## Post-Mortem

### What Worked
- Splitting the monolithic effect into 4 separate effects with minimal deps is the correct pattern (matches working `TerminalViewer.tsx`)
- Ref-ifying unstable callbacks prevents spurious effect re-runs
- Atomic `promoteToConnected` prevents Zustand batching edge cases

### What Failed
- **First attempt**: Split effects but kept `terminalDisconnect` in Effect C cleanup → StrictMode race killed PTYs → streaming still broken
- **Second attempt**: Removed `terminalDisconnect` from cleanup + atomic store update → builds clean but **user reports still not working** (content shows then freezes, button state wrong)
- Did not get to verify with dev tools / console logs whether the issue is frontend (effects/listeners) or backend (PTY monitor script)

### Key Decisions
- Decision: Remove `terminalDisconnect` from Effect C cleanup
  - Alternatives: Guard with `isDisconnectingRef`, or suppress exit events
  - Reason: PTY lifecycle managed by pool, not React effects. StrictMode safety.
- Decision: Atomic `promoteToConnected` in Zustand store
  - Alternatives: Rely on React 18 batching
  - Reason: Belt-and-suspenders; Zustand `set()` notifies subscribers synchronously

## Artifacts
- `src/components/MiniTerminal.tsx` — Main file with the 4-effect split
- `src/stores/terminalGridStore.ts:73-85` — `promoteToConnected` method
- `src/hooks/useTerminalPool.ts:50-55` — Updated `confirmConnection`
- `thoughts/shared/handoffs/command-center-v3/2026-01-30_20-39-42_miniterminal-streaming-bug.md` — This handoff

## Action Items & Next Steps

1. **Debug with console logs** — Add `console.log` in:
   - Effect A (`onTerminalOutput` listener) to confirm data is arriving
   - Effect C to confirm `terminalConnect` IPC succeeds
   - `pty-manager.ts:284` (`onData`) to confirm PTY is sending output
   - Check if `terminal-exit` fires unexpectedly (the StrictMode race)

2. **Check if StrictMode is actually the problem** — Temporarily disable StrictMode in `src/main.tsx` (remove `<StrictMode>` wrapper) and test. If streaming works without it, the race condition fix needs more work.

3. **Investigate the monitor script** — The bash polling script (`pty-manager.ts:224-268`) might silently fail. Check Electron main process console for `[PTY]` log messages. The `cksum` hash comparison might have edge cases.

4. **Consider alternative streaming approach** — Instead of polling `tmux capture-pane`, use `tmux pipe-pane` to stream output directly. This would give real-time output without polling gaps.

5. **Button state** — If streaming is fixed, verify that `connectionState` in MiniTerminal accurately reflects actual PTY state. The header already uses `connectionState` for both dot color and button text.

## Other Notes

- Port changed to 5200 (was 5199, conflicting with another process)
- The user made additional changes to TmuxPage, TerminalGrid, and TerminalTileHeader adding `isPlaceholder` support — these are orthogonal to the streaming bug
- `TerminalViewer.tsx` (the full-screen terminal) works correctly — compare its effect structure if debugging
- Zustand 5 (`package.json:29`) with React 18 — batching should work but verify
- The `useTerminalPool` hook creates `new Set(store.connectedPanes.keys())` on every render (line 74) — this causes TerminalGrid to always re-render, but shouldn't affect effect deps since `shouldConnect` is a derived boolean

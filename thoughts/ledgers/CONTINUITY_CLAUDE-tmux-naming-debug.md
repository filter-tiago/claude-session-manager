# Session: tmux-naming-debug
Updated: 2026-01-31T16:42:27.578Z

## Goal
Fix smart tmux session naming so creating a session opens in iTerm with a unique tmux name.

Done when:
- Creating session with existing tmux name creates a unique variant (ea → ea-3)
- New session opens in iTerm automatically
- No "duplicate session" errors

## Problem Statement (Corrected)
Two issues discovered:

1. **Wrong file investigated first**: Spent time on `workspace-manager.ts` when the issue was in `tmux-mapper.ts` (`spawnClaudeSession()`)
2. **Missing iTerm open**: `spawnClaudeSession()` creates tmux session + starts Claude, but never opens an external terminal. User sees "nothing happened" because everything is headless in tmux.

## What Was Tried

### Attempt 1: WRONG FILE (workspace-manager.ts)
- Added try-create-catch-duplicate to `generateUniqueTmuxName()`
- Added debug logging (later removed)
- **Result**: Wrong code path. Sessions are created via `spawnClaudeSession()` in `tmux-mapper.ts`, not workspace creation.

### Attempt 2: Fixed tmux-mapper.ts
- Added `createUniqueTmuxSession()` to `tmux-mapper.ts`
- Modified `spawnClaudeSession()` to use it
- **Result**: tmux sessions now created with unique names (ea-3, l confirmed in `tmux list-sessions`)

### Attempt 3: Fixed iTerm opening
- User reported "nothing happened" - dialog closed but no terminal appeared
- Root cause: IPC handler `spawn-session` called `spawnClaudeSession()` but never `openExternalTerminal()`
- Fix: Added `openExternalTerminal(result.pane.session)` call after successful spawn in `main.ts`
- **Result**: PENDING VERIFICATION

## Key Learnings
1. **Ask what the user means by "error"** - "nothing happened" ≠ "error message shown"
2. **Trace from UI to backend** - Don't guess the file; follow the actual code path
3. **Session creation ≠ Workspace creation** - Different code paths entirely
4. The `openExternalTerminal()` function already existed in `terminal-launcher.ts` but was only used by `openSessionTerminal()` and `resumeInNewPane()`, not by `spawn-session` IPC

## State
- [x] Fix duplicate tmux session names (tmux-mapper.ts - createUniqueTmuxSession)
- [x] Fix duplicate tmux session names (workspace-manager.ts - generateUniqueTmuxName)
- [x] Fix iTerm opening after spawn (main.ts - spawn-session handler)
- [x] Remove debug logging from workspace-manager.ts
- [x] Build passes
- [ ] User verification: restart app, create session, confirm iTerm opens

## Files Changed
- `electron/services/tmux-mapper.ts` - Added `createUniqueTmuxSession()`, updated `spawnClaudeSession()`
- `electron/services/workspace-manager.ts` - Refactored `generateUniqueTmuxName()` to try-create-catch-duplicate, simplified `createWorkspace()`
- `electron/main.ts` - Added `openExternalTerminal` import, modified `spawn-session` handler to open iTerm after spawn

## Also Added to tmux-mapper.ts (by linter/user)
- `TmuxSessionInfo` interface
- `getTmuxSessions()` - list all tmux sessions with metadata
- `killTmuxSession()` - kill by name
- `renameTmuxSession()` - rename + update DB references

## Key Files
- `electron/services/tmux-mapper.ts:380` - `spawnClaudeSession()` (the actual spawn function)
- `electron/services/tmux-mapper.ts:36` - `createUniqueTmuxSession()` (new dedup logic)
- `electron/services/terminal-launcher.ts:91` - `openExternalTerminal()` (iTerm/Terminal opener)
- `electron/main.ts:435` - `spawn-session` IPC handler (now opens terminal)

## Verification
1. Restart app
2. Create new session for any project
3. Should: dialog closes → iTerm opens → tmux attached → Claude running
4. If tmux name taken: should silently use next available name

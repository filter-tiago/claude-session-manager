# Task 01: Hook → App Communication

**Status:** Complete
**Completed:** 2026-01-25

## Summary

Implemented the foundational communication layer between Claude CLI stop hooks and the Electron Session Manager app. Events flow from the Python hook through the filesystem to the Electron watcher.

## What Was Built

### 1. TypeScript Types (`src/types/notifications.ts`)

Defined the complete type system for notifications:
- `SessionNotificationEvent` - The raw event schema written by hooks
- `ProcessedNotification` - Extended event with AI-added intelligence (for Phase 3)
- `NotificationPreferences` - User preferences (for Phase 5)
- Supporting types: `StopType`, `VerificationResult`, `PreAnalysis`

### 2. Python Stop Hook Update (`~/.claude/hooks/stop-verify-completion.py`)

Extended the existing verification hook to:
- Extract session context (project path, tools used, files modified)
- Classify stop types: `completed`, `blocked`, `error`, `user_stop`
- Write structured JSON events to `~/.claude/notifications/pending/`
- Extract last 3 assistant messages for summary context
- Include pre-analysis: `codeChanged`, `buildRan`, `testsRan`

New functions added:
- `emit_notification_event()` - Writes event to pending directory
- `extract_tools_used()` - Parses transcript for tool mentions
- `extract_files_modified()` - Parses transcript for file changes
- `extract_last_messages()` - Gets last N assistant messages
- `classify_stop_type()` - Determines stop classification

### 3. Electron Notification Watcher (`electron/services/notification-watcher.ts`)

Created a chokidar-based file watcher that:
- Watches `~/.claude/notifications/pending/` for new JSON files
- Parses and validates event structure
- Emits events to renderer via callback
- Moves processed files to `~/.claude/notifications/processed/`
- Processes existing pending notifications on startup
- Uses `awaitWriteFinish` to avoid partial file reads

Exported functions:
- `startNotificationWatcher(callback)` - Start watching
- `stopNotificationWatcher()` - Clean shutdown
- `cleanupOldNotifications(maxAgeDays)` - Remove old processed files
- `ensureNotificationDirs()` - Create directory structure
- `getNotificationPaths()` - Get directory paths

### 4. Main Process Integration (`electron/main.ts`)

Added:
- Import notification watcher service
- Start watcher on app ready with callback that:
  - Logs notification receipt
  - Sends `session-notification` IPC event to renderer
  - Shows native notification for `blocked` and `error` stop types
  - Makes notifications clickable to focus session
- Stop watcher on app quit
- Clean up old notifications on startup (7 days)
- IPC handler for `get-notification-paths`

### 5. Preload Bridge (`electron/preload.cjs`)

Added renderer API:
- `onSessionNotification(callback)` - Listen for notification events
- `getNotificationPaths()` - Get directory paths for settings UI

### 6. Type Definitions (`src/types/electron.d.ts`)

Updated ElectronAPI interface with:
- `onSessionNotification()` listener
- `getNotificationPaths()` method
- `NotificationPaths` interface

## Directory Structure Created

```
~/.claude/notifications/
├── pending/     # New events from hooks
└── processed/   # Handled events (kept 7 days)
```

## Event Flow

```
Claude CLI stops
    │
    ▼
Stop hook runs (stop-verify-completion.py)
    │
    ├── Classifies stop type
    ├── Extracts context
    └── Writes to pending/<uuid>.json
    │
    ▼
Chokidar detects file (notification-watcher.ts)
    │
    ├── Parses JSON
    ├── Validates schema
    ├── Emits to renderer via IPC
    └── Moves to processed/
    │
    ▼
Renderer receives 'session-notification' event
    │
    └── (Phase 2: NotificationManager handles routing)
```

## Verified

- [x] Build compiles without errors (`npm run build`)
- [x] Hook writes correct JSON format (tested manually)
- [x] Event includes all required fields per schema
- [x] `completed` and `blocked` classifications work correctly
- [x] Directories created automatically

## Test Commands Used

```bash
# Test blocked scenario (code changes, no verification)
echo '{"transcript": "I used the Edit tool to modify main.ts", "stopReason": "end_turn", "sessionId": "test-123"}' | python3 ~/.claude/hooks/stop-verify-completion.py

# Test completed scenario (code changes with build)
echo '{"transcript": "I used the Edit tool to modify main.ts and ran npm run build successfully", "stopReason": "end_turn", "sessionId": "test-456"}' | python3 ~/.claude/hooks/stop-verify-completion.py
```

## Files Modified

| File | Changes |
|------|---------|
| `~/.claude/hooks/stop-verify-completion.py` | Added notification emission |
| `src/types/notifications.ts` | NEW - Event type definitions |
| `electron/services/notification-watcher.ts` | NEW - Chokidar watcher |
| `electron/main.ts` | Added watcher init, IPC handler, native notifications |
| `electron/preload.cjs` | Added notification API |
| `src/types/electron.d.ts` | Added notification types to API |

## Notes for Next Phase

Phase 2 (Notification Manager Service) should:
1. Create `NotificationManager` class in `electron/services/`
2. Subscribe to notification events from the watcher
3. Route notifications based on type and preferences
4. Coordinate native notifications, sounds, tray updates, and in-app toasts

The watcher currently shows basic native notifications for blocked/error states - this should be moved to the NotificationManager for centralized control.

## Issues Encountered

1. **Pre-existing TypeScript errors** - `config-manager.ts` had unused variable warnings that needed fixing
2. **External changes to main.ts** - Config manager imports were added externally, needed to resolve merge
3. **Strict noUnusedLocals** - Had to remove redundant cleanup variables since `stopConfigWatchers()` handles cleanup

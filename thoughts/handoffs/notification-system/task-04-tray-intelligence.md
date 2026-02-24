# Task 04: Tray Icon Intelligence

**Status:** Complete
**Date:** 2025-01-25

## Summary

Implemented visual feedback in the system tray with dynamic colored icons, pulse animations, and macOS dock badge integration. The tray now reflects the current notification state:

| State     | Icon Color | Behavior                           |
|-----------|------------|-------------------------------------|
| idle      | Gray       | No active sessions, static icon    |
| active    | Green      | Sessions running, static icon      |
| attention | Orange     | Blocked/needs attention, pulsing   |
| error     | Red        | Crash detected, static icon        |

## Files Created

### `/Users/partiu/workspace/claude-session-manager/electron/services/tray-manager.ts`

Central tray state management service with:

**Icon Generation:**
- `generateIconPNG()` - Creates colored circle icons programmatically (16x16 and 32x32)
- `encodePNG()` - Minimal PNG encoder (no external dependencies)
- `crc32()` - CRC32 calculation for PNG chunks
- `adjustBrightness()` - Color dimming for pulse animation
- `getIcon()` - Icon caching with retina support

**State Management:**
- `setTrayState()` - Set icon state with optional pending count
- `determineTrayState()` - Calculate state from notifications
- `updateTrayFromNotifications()` - Convenience method combining both
- `getCurrentTrayState()` / `getPendingCount()` - State getters

**Animation:**
- `startPulse()` / `stopPulse()` - 500ms toggle animation for attention state
- Automatically starts when state is 'attention', stops otherwise

**macOS Integration:**
- `updateDockBadge()` - Sets `app.dock.setBadge()` with pending count
- Badge cleared when count reaches 0

**Initialization & Cleanup:**
- `initTrayManager()` - Sets up tray with icon, menu, and click handler
- `preloadIcons()` - Pre-generates all icon variants for responsiveness
- `cleanupTrayManager()` - Stops pulse, clears icon cache

**Context Menu:**
- Shows current state description
- "Clear All Notifications" option when pending > 0
- "Show Session Manager" and "Quit" actions

**Public API:**
```typescript
// Initialize with tray instance
initTrayManager(tray: Tray, window: BrowserWindow | null, quitCallback: () => void): void

// Update state from notifications
updateTrayFromNotifications(notifications: ProcessedNotification[], quitCallback?: () => void): void

// Direct state control
setTrayState(state: TrayState, count?: number, quitCallback?: () => void): void

// Session navigation
showSessionInApp(sessionId: string): void

// Cleanup
cleanupTrayManager(): void
preloadIcons(): void
```

## Files Modified

### `/Users/partiu/workspace/claude-session-manager/electron/services/notification-manager.ts`

**Changes:**
1. Added imports from tray-manager
2. Added `quitCallback` state for tray menu integration
3. Updated `initNotificationManager()` to accept quit callback and initialize TrayManager
4. Updated `setMainWindow()` to also update TrayWindow
5. Simplified `updateTrayBadge()` to delegate to TrayManager
6. Deprecated `setTray()` - TrayManager now handles tray directly
7. Added `cleanupNotificationManager()` export

### `/Users/partiu/workspace/claude-session-manager/electron/services/sound-manager.ts`

**Bug Fix:**
- Added ESM-compatible `__dirname` definition using `fileURLToPath(import.meta.url)`
- This was a pre-existing bug that caused crashes on app startup

### `/Users/partiu/workspace/claude-session-manager/electron/services/index.ts`

**Changes:**
- Added `export * from './tray-manager'`

### `/Users/partiu/workspace/claude-session-manager/electron/main.ts`

**Changes:**
1. Added `cleanupNotificationManager` import
2. Simplified `createTray()` - TrayManager now handles menu and click
3. Updated `initNotificationManager()` call to pass quit callback
4. Added `cleanupNotificationManager()` to `before-quit` handler

## Icon Generation Details

Icons are generated programmatically as PNG data:

1. **Circle Rendering**: Anti-aliased filled circle using distance-from-center calculation
2. **PNG Encoding**: Manual IHDR/IDAT/IEND chunk creation with zlib compression
3. **Caching**: Icons cached by state+dimmed key to avoid regeneration
4. **Retina Support**: Both 1x (16px) and 2x (32px) representations added

Icon colors:
- Idle: `#6b7280` (Tailwind gray-500)
- Active: `#22c55e` (Tailwind green-500)
- Attention: `#f97316` (Tailwind orange-500)
- Error: `#ef4444` (Tailwind red-500)

## State Determination Logic

From `determineTrayState()`:

```typescript
// Priority: error > attention > active > idle
if (hasError) return 'error';
if (hasAttention) return 'attention';
if (notifications.length > 0) return 'active';
return 'idle';
```

The count is specifically for `needs_attention` + `error` categories (items requiring user action).

## Testing Notes

1. **Build verification**: `npm run build` passes
2. **Runtime verification**: App starts, logs show:
   - `[TrayManager] Icons preloaded`
   - `[TrayManager] Initialized`
3. **Tray behavior**: Click toggles window visibility

## Architecture Decisions

1. **Programmatic PNG generation**: Avoids bundling image files, ensures consistent quality at all resolutions

2. **Icon caching**: Pre-generation of all 8 variants (4 states x 2 dim levels) prevents lag during state transitions

3. **Delegation from NotificationManager**: TrayManager owns all tray state; NotificationManager delegates via `updateTrayFromNotifications()`

4. **Quit callback pattern**: Passed through to enable proper cleanup in tray menu

5. **No template images on macOS**: Using colored icons instead of template images for clear state indication

## Next Phase Dependencies

Phase 5 (Settings & Preferences UI) can:
- Toggle tray badge visibility via existing `configureNotifications({ trayBadge: boolean })`
- Add toggle for pulse animation
- Configure which states trigger dock badge

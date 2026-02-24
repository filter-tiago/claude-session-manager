# Task 03: AI Intelligence Layer

**Status:** Complete
**Date:** 2025-01-25

## Summary

Implemented context-aware AI analysis for notification events with a two-path architecture:
- **Fast path (rule-based)**: Always runs, provides basic analysis in milliseconds
- **Rich path (Claude API)**: Triggered for high-importance events (score >= 50), provides enhanced summaries

## Files Created

### `/Users/partiu/workspace/claude-session-manager/electron/services/ai-analyzer.ts`

Central AI analysis service with:

**Types:**
- `AIAnalysisResult` - Contains `importanceScore`, `summary`, `category`, `suggestedAction`, `analyzedBy`

**Rule-based Analysis:**
- `calculateImportanceScore()` - Enhanced scoring with caps and stop-type bonuses
- `detectCategory()` - Detects feature/bugfix/refactor/docs/chat from message content
- `extractSummaryFromMessages()` - Extracts key sentences from last messages
- `generateSuggestedAction()` - Context-aware action suggestions

**Claude API Integration:**
- Uses `claude-3-haiku-20240307` model (fast, cheap)
- 10-second timeout with AbortController
- Graceful fallback to rules if API fails or no key
- API key from `process.env.ANTHROPIC_API_KEY`

**Caching:**
- 5-minute TTL cache keyed by `eventId`
- Auto-cleanup when cache exceeds 100 entries
- `clearAnalysisCache()` export for manual clearing

**Public API:**
```typescript
// Async - may call Claude API for high-importance events
analyzeSession(event: SessionNotificationEvent): Promise<AIAnalysisResult>

// Sync - rules only, for when async isn't possible
analyzeSessionSync(event: SessionNotificationEvent): AIAnalysisResult

// Cache management
clearAnalysisCache(): void
```

## Files Modified

### `/Users/partiu/workspace/claude-session-manager/electron/services/notification-manager.ts`

**Changes:**
1. Imports `analyzeSession`, `analyzeSessionSync`, `AIAnalysisResult` from ai-analyzer
2. Updated `getNotificationTitle()` to use AI analysis
   - Blocked: "Needs Verification" when summary available
   - Error: "Session Crashed"
   - Completed: Shows project name directly
3. Updated `getNotificationBody()` to prefer AI summary
4. Updated `showNativeNotification()` to accept analysis parameter
5. Removed local `calculateImportance()` (now in AIAnalyzer)
6. Modified `processNotification()` to use `analyzeSessionSync()`
7. Added `processNotificationAsync()` for full AI analysis with Claude API

### `/Users/partiu/workspace/claude-session-manager/electron/main.ts`

**Changes:**
1. Import changed from `processNotification` to `processNotificationAsync`
2. Watcher callback now uses async version with error handling

### `/Users/partiu/workspace/claude-session-manager/electron/services/index.ts`

**Changes:**
- Added export for `./ai-analyzer`

## Notification Content by Analysis

| Stop Type | Importance | Title | Body | Sound | Native |
|-----------|------------|-------|------|-------|--------|
| blocked | any | "Needs Verification" | "[Project]: [AI summary]" | attention | Yes |
| error | any | "Session Crashed" | "[Project]: [reason]" | error | Yes |
| completed | high (50+) | "[Project]" | "[AI summary]" | success | Yes |
| completed | low (<50) | "[Project]" | "[AI summary]" | subtle | No |

## Category Detection

The AI analyzer detects work type from message content:

| Category | Keywords |
|----------|----------|
| bugfix | fix, bug, error, issue, patch |
| feature | add, implement, create, new feature, build |
| refactor | refactor, clean up, reorganize, rename |
| docs | document, readme, comment, .md files |
| chat | No files modified, only Read/Grep/Glob tools |
| unknown | None of the above |

## Environment Variables

- `ANTHROPIC_API_KEY` - Optional. If not set, only rule-based analysis runs.

## Testing Notes

1. **Without API key**: All analysis uses rules, works fully
2. **With API key**: High-importance events (score >= 50) get Claude API enhancement
3. **API failures**: Gracefully fall back to rules, log error

## Architecture Decisions

1. **Haiku model**: Chose claude-3-haiku for speed and cost. This is a quick summary task, not complex reasoning.

2. **Importance threshold of 50**: Balances API cost vs value. Only ~30% of events should trigger API calls.

3. **5-minute cache**: Prevents duplicate API calls for same event while allowing fresh analysis for new events.

4. **Sync fallback**: `analyzeSessionSync()` ensures we never block on API calls if sync is required.

5. **No SDK dependency**: Used raw fetch instead of @anthropic-ai/sdk to keep dependencies minimal.

## Next Phase Dependencies

Phase 4 (Tray Icon Intelligence) can use:
- `category` field for icon color/pulse
- `importance` for badge priority
- `suggestedAction` for tray menu quick actions

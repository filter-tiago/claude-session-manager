/**
 * Types for the AI-First Notification System
 *
 * Events flow from Claude CLI hooks → filesystem → Electron app
 */

export type StopType = 'completed' | 'blocked' | 'error' | 'user_stop';

export interface VerificationResult {
  required: boolean;
  passed: boolean;
  reason?: string;
}

export interface PreAnalysis {
  codeChanged: boolean;
  buildRan: boolean;
  testsRan: boolean;
}

/**
 * Raw notification event written by the stop hook
 * This is the file format in ~/.claude/notifications/pending/
 */
export interface SessionNotificationEvent {
  eventId: string;
  timestamp: string;
  sessionId: string;
  projectPath: string;
  projectName: string;
  stopType: StopType;
  verification: VerificationResult;
  lastMessages: string[];  // Last 3 for summary
  toolsUsed: string[];
  filesModified: string[];
  preAnalysis: PreAnalysis;
}

/**
 * Processed notification with AI-added intelligence
 * This is what the NotificationManager works with
 */
export interface ProcessedNotification extends SessionNotificationEvent {
  processedAt: string;

  // AI-added fields (Phase 3)
  summary?: string;
  importance?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'success' | 'needs_attention' | 'error' | 'info';
  suggestedAction?: string;
}

/**
 * Notification preferences (Phase 5)
 */
export interface NotificationPreferences {
  enabled: boolean;
  soundEnabled: boolean;
  nativeNotifications: boolean;
  inAppToasts: boolean;
  trayBadge: boolean;

  // Filtering
  minImportance: 'low' | 'medium' | 'high' | 'critical';
  mutedProjects: string[];
  focusMode: boolean;
}

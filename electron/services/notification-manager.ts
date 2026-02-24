/**
 * Notification Manager Service
 *
 * Central hub for processing and routing notification events from Claude CLI sessions.
 * Coordinates between:
 * - NotificationWatcher (receives raw events)
 * - SoundManager (plays audio feedback)
 * - Native Notifications (system notifications)
 * - Tray (badge updates)
 * - Renderer (in-app toasts)
 *
 * Routing Logic based on stop type and importance:
 * | Stop Type | Importance | Sound     | Native Notification |
 * |-----------|------------|-----------|---------------------|
 * | blocked   | any        | attention | Yes, actionable     |
 * | error     | any        | error     | Yes, urgent         |
 * | completed | high (50+) | success   | Yes, with summary   |
 * | completed | low (<50)  | subtle    | No (or silent)      |
 * | user_stop | any        | none      | No                  |
 */

import { Notification, BrowserWindow, Tray } from 'electron';
import type { SessionNotificationEvent, ProcessedNotification } from '../../src/types/notifications';
// Note: StopType is intentionally not imported - we use string comparison instead
import { playSound, ensureSoundFiles, setSoundsEnabled, setVolume, type SoundType } from './sound-manager';
import { analyzeSession, analyzeSessionSync, type AIAnalysisResult } from './ai-analyzer';
import {
  initTrayManager,
  setTrayWindow,
  updateTrayFromNotifications,
  preloadIcons,
  cleanupTrayManager,
} from './tray-manager';

// Event callback type
type NotificationCallback = (event: ProcessedNotification) => void;

// Manager state
let mainWindow: BrowserWindow | null = null;
let rendererCallback: NotificationCallback | null = null;
let quitCallback: (() => void) | null = null;

// Pending notifications for tray badge
let pendingNotifications: ProcessedNotification[] = [];

// Configuration
let nativeNotificationsEnabled = true;
let inAppToastsEnabled = true;
let trayBadgeEnabled = true;

/**
 * Initialize the notification manager
 */
export function initNotificationManager(
  window: BrowserWindow | null,
  trayInstance: Tray | null,
  onQuit?: () => void
): void {
  mainWindow = window;
  quitCallback = onQuit || null;

  // Ensure sound files exist
  ensureSoundFiles();

  // Initialize tray manager with visual icon states
  if (trayInstance) {
    preloadIcons();
    initTrayManager(
      trayInstance,
      window,
      onQuit || (() => {})
    );
  }

  console.log('[NotificationManager] Initialized');
}

/**
 * Update the window reference (e.g., after window recreation)
 */
export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
  setTrayWindow(window);
}

/**
 * Update the tray reference
 * @deprecated TrayManager now handles tray directly
 */
export function setTray(_trayInstance: Tray | null): void {
  // TrayManager handles tray state directly now
  // This function is kept for API compatibility
}

/**
 * Set callback for renderer notifications
 */
export function setRendererCallback(callback: NotificationCallback | null): void {
  rendererCallback = callback;
}

/**
 * Determine the importance level from score
 * Note: Importance calculation is now handled by AIAnalyzer
 */
function getImportanceLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

/**
 * Determine category based on stop type and verification
 */
function getCategory(event: SessionNotificationEvent): 'success' | 'needs_attention' | 'error' | 'info' {
  if (event.stopType === 'error') return 'error';
  if (event.stopType === 'blocked') return 'needs_attention';
  if (event.stopType === 'completed') return 'success';
  return 'info';
}

/**
 * Determine which sound to play based on event
 */
function getSoundForEvent(event: SessionNotificationEvent, importanceScore: number): SoundType | null {
  switch (event.stopType) {
    case 'blocked':
      return 'attention';
    case 'error':
      return 'error';
    case 'completed':
      return importanceScore >= 50 ? 'success' : 'subtle';
    case 'user_stop':
      return null; // No sound for user-initiated stops
    default:
      return null;
  }
}

/**
 * Check if native notification should be shown
 */
function shouldShowNativeNotification(event: SessionNotificationEvent, importanceScore: number): boolean {
  if (!nativeNotificationsEnabled) return false;

  switch (event.stopType) {
    case 'blocked':
    case 'error':
      return true; // Always notify for blocked/error
    case 'completed':
      return importanceScore >= 50; // Only high importance completions
    case 'user_stop':
      return false;
    default:
      return false;
  }
}

/**
 * Get notification title based on stop type and analysis
 */
function getNotificationTitle(event: SessionNotificationEvent, analysis?: AIAnalysisResult): string {
  switch (event.stopType) {
    case 'blocked':
      return analysis?.summary ? 'Needs Verification' : 'Session Needs Attention';
    case 'error':
      return 'Session Crashed';
    case 'completed':
      return event.projectName;
    case 'user_stop':
      return 'Session Stopped';
    default:
      return 'Session Update';
  }
}

/**
 * Get notification body based on event data and AI analysis
 */
function getNotificationBody(event: SessionNotificationEvent, analysis?: AIAnalysisResult): string {
  const projectName = event.projectName;

  // Use AI summary if available
  if (analysis?.summary) {
    return `${projectName}: ${analysis.summary}`;
  }

  const reason = event.verification.reason;
  if (reason) {
    return `${projectName}: ${reason}`;
  }

  const filesChanged = event.filesModified.length;
  if (filesChanged > 0) {
    return `${projectName}: ${filesChanged} file${filesChanged > 1 ? 's' : ''} modified`;
  }

  return projectName;
}

/**
 * Show a native system notification
 */
function showNativeNotification(event: SessionNotificationEvent, analysis?: AIAnalysisResult): void {
  if (!Notification.isSupported()) {
    console.log('[NotificationManager] Native notifications not supported');
    return;
  }

  const notification = new Notification({
    title: getNotificationTitle(event, analysis),
    body: getNotificationBody(event, analysis),
    silent: true, // We handle sound separately
    urgency: event.stopType === 'error' ? 'critical' : event.stopType === 'blocked' ? 'normal' : 'low',
  });

  notification.on('click', () => {
    // Show window and select the session
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('select-session', event.sessionId);
    }
  });

  notification.show();
  console.log(`[NotificationManager] Showed native notification for ${event.sessionId}`);
}

/**
 * Send notification to renderer for in-app toast
 */
function sendToRenderer(processed: ProcessedNotification): void {
  if (inAppToastsEnabled && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('session-notification', processed);
    console.log(`[NotificationManager] Sent to renderer: ${processed.eventId}`);
  }

  // Also call the callback if set
  if (rendererCallback) {
    rendererCallback(processed);
  }
}

/**
 * Update tray badge with pending notifications count
 * Uses TrayManager for visual icon states and dock badge
 */
function updateTrayBadge(): void {
  if (!trayBadgeEnabled) return;

  // Delegate to TrayManager for visual updates
  updateTrayFromNotifications(pendingNotifications, quitCallback || undefined);
}

/**
 * Add a notification to the pending list
 * @param skipTrayUpdate - If true, don't update tray badge (for batch operations)
 */
function addToPending(processed: ProcessedNotification, skipTrayUpdate = false): void {
  // Keep only last 50 notifications
  if (pendingNotifications.length >= 50) {
    pendingNotifications = pendingNotifications.slice(-49);
  }

  pendingNotifications.push(processed);

  if (!skipTrayUpdate) {
    updateTrayBadge();
  }
}

/**
 * Clear a notification from pending (when user acknowledges)
 */
export function clearPendingNotification(eventId: string): void {
  pendingNotifications = pendingNotifications.filter(n => n.eventId !== eventId);
  updateTrayBadge();
}

/**
 * Clear all pending notifications
 */
export function clearAllPendingNotifications(): void {
  pendingNotifications = [];
  updateTrayBadge();
}

/**
 * Get all pending notifications
 */
export function getPendingNotifications(): ProcessedNotification[] {
  return [...pendingNotifications];
}

/**
 * Process notification silently (for startup backlog)
 * - No sound
 * - No native notification
 * - No IPC to renderer
 * - Just track in pending list (without updating tray for each one)
 */
export function processNotificationSilent(event: SessionNotificationEvent): ProcessedNotification {
  // Get AI analysis (sync version - rules only)
  const analysis = analyzeSessionSync(event);

  // Use AI analysis for importance
  const importanceScore = analysis.importanceScore;
  const importanceLevel = getImportanceLevel(importanceScore);
  const category = getCategory(event);

  // Create processed notification with AI fields
  const processed: ProcessedNotification = {
    ...event,
    processedAt: new Date().toISOString(),
    importance: importanceLevel,
    category,
    summary: analysis.summary,
    suggestedAction: analysis.suggestedAction,
  };

  // Add to pending WITHOUT updating tray (will update once at end)
  addToPending(processed, true);

  return processed;
}

/**
 * Force tray badge update (call after batch silent processing)
 */
export function forceUpdateTrayBadge(): void {
  updateTrayBadge();
}

/**
 * Process a notification event (sync version - uses rule-based analysis only)
 * This is the main entry point called by the NotificationWatcher
 */
export function processNotification(event: SessionNotificationEvent): ProcessedNotification {
  console.log(`[NotificationManager] Processing (sync): ${event.stopType} for ${event.projectName}`);

  // Get AI analysis (sync version - rules only)
  const analysis = analyzeSessionSync(event);

  // Use AI analysis for importance, fall back to local calculation
  const importanceScore = analysis.importanceScore;
  const importanceLevel = getImportanceLevel(importanceScore);
  const category = getCategory(event);

  // Create processed notification with AI fields
  const processed: ProcessedNotification = {
    ...event,
    processedAt: new Date().toISOString(),
    importance: importanceLevel,
    category,
    summary: analysis.summary,
    suggestedAction: analysis.suggestedAction,
  };

  // Play appropriate sound
  const sound = getSoundForEvent(event, importanceScore);
  if (sound) {
    playSound(sound);
  }

  // Show native notification if appropriate
  if (shouldShowNativeNotification(event, importanceScore)) {
    showNativeNotification(event, analysis);
  }

  // Send to renderer for in-app handling
  sendToRenderer(processed);

  // Track for tray badge
  addToPending(processed);

  console.log(`[NotificationManager] Processed: importance=${importanceLevel}, category=${category}, score=${importanceScore}, analyzedBy=${analysis.analyzedBy}`);

  return processed;
}

/**
 * Process a notification event with full AI analysis (async version)
 * Use this when you can await - it will call Claude API for high-importance events
 */
export async function processNotificationAsync(event: SessionNotificationEvent): Promise<ProcessedNotification> {
  console.log(`[NotificationManager] Processing (async): ${event.stopType} for ${event.projectName}`);

  // Get AI analysis (async version - may call Claude API)
  const analysis = await analyzeSession(event);

  // Use AI analysis for importance
  const importanceScore = analysis.importanceScore;
  const importanceLevel = getImportanceLevel(importanceScore);
  const category = getCategory(event);

  // Create processed notification with AI fields
  const processed: ProcessedNotification = {
    ...event,
    processedAt: new Date().toISOString(),
    importance: importanceLevel,
    category,
    summary: analysis.summary,
    suggestedAction: analysis.suggestedAction,
  };

  // Play appropriate sound
  const sound = getSoundForEvent(event, importanceScore);
  if (sound) {
    playSound(sound);
  }

  // Show native notification if appropriate
  if (shouldShowNativeNotification(event, importanceScore)) {
    showNativeNotification(event, analysis);
  }

  // Send to renderer for in-app handling
  sendToRenderer(processed);

  // Track for tray badge
  addToPending(processed);

  console.log(`[NotificationManager] Processed: importance=${importanceLevel}, category=${category}, score=${importanceScore}, analyzedBy=${analysis.analyzedBy}`);

  return processed;
}

/**
 * Configure notification preferences
 */
export function configureNotifications(options: {
  nativeNotifications?: boolean;
  inAppToasts?: boolean;
  trayBadge?: boolean;
  soundsEnabled?: boolean;
  volume?: number;
}): void {
  if (options.nativeNotifications !== undefined) {
    nativeNotificationsEnabled = options.nativeNotifications;
  }
  if (options.inAppToasts !== undefined) {
    inAppToastsEnabled = options.inAppToasts;
  }
  if (options.trayBadge !== undefined) {
    trayBadgeEnabled = options.trayBadge;
  }
  if (options.soundsEnabled !== undefined) {
    setSoundsEnabled(options.soundsEnabled);
  }
  if (options.volume !== undefined) {
    setVolume(options.volume);
  }

  console.log('[NotificationManager] Configuration updated');
}

/**
 * Get current configuration
 */
export function getNotificationConfig(): {
  nativeNotifications: boolean;
  inAppToasts: boolean;
  trayBadge: boolean;
} {
  return {
    nativeNotifications: nativeNotificationsEnabled,
    inAppToasts: inAppToastsEnabled,
    trayBadge: trayBadgeEnabled,
  };
}

/**
 * Cleanup notification manager resources
 * Call on app quit
 */
export function cleanupNotificationManager(): void {
  cleanupTrayManager();
  console.log('[NotificationManager] Cleaned up');
}

/**
 * Notification Watcher Service
 *
 * Watches ~/.claude/notifications/pending/ for new notification events
 * from Claude CLI stop hooks, then emits them to the renderer process.
 *
 * Event flow:
 *   Stop hook writes JSON → chokidar detects → parse → emit to renderer → move to processed/
 */

import { watch, FSWatcher } from 'chokidar';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { SessionNotificationEvent } from '../../src/types/notifications';

// Directory paths
const NOTIFICATIONS_DIR = path.join(os.homedir(), '.claude', 'notifications');
const PENDING_DIR = path.join(NOTIFICATIONS_DIR, 'pending');
const PROCESSED_DIR = path.join(NOTIFICATIONS_DIR, 'processed');

let watcher: FSWatcher | null = null;
let notificationCallback: ((event: SessionNotificationEvent, options?: { silent?: boolean }) => void) | null = null;

/**
 * Ensure notification directories exist
 */
export function ensureNotificationDirs(): void {
  for (const dir of [NOTIFICATIONS_DIR, PENDING_DIR, PROCESSED_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[NotificationWatcher] Created directory: ${dir}`);
    }
  }
}

/**
 * Parse a notification event file
 */
function parseNotificationFile(filePath: string): SessionNotificationEvent | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const event = JSON.parse(content) as SessionNotificationEvent;

    // Validate required fields
    if (!event.eventId || !event.sessionId || !event.stopType) {
      console.error(`[NotificationWatcher] Invalid event file (missing required fields): ${filePath}`);
      return null;
    }

    return event;
  } catch (error) {
    console.error(`[NotificationWatcher] Failed to parse event file: ${filePath}`, error);
    return null;
  }
}

/**
 * Move processed event file from pending/ to processed/
 */
function moveToProcessed(filePath: string): void {
  try {
    const filename = path.basename(filePath);
    const destPath = path.join(PROCESSED_DIR, filename);

    fs.renameSync(filePath, destPath);
    console.log(`[NotificationWatcher] Moved to processed: ${filename}`);
  } catch (error) {
    console.error(`[NotificationWatcher] Failed to move file to processed:`, error);
    // Try to delete to avoid re-processing
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignore deletion error
    }
  }
}

/**
 * Process a new notification file
 */
function processNotificationFile(filePath: string, options?: { silent?: boolean }): void {
  // Only process .json files
  if (!filePath.endsWith('.json')) {
    return;
  }

  if (!options?.silent) {
    console.log(`[NotificationWatcher] Processing: ${path.basename(filePath)}`);
  }

  const event = parseNotificationFile(filePath);

  if (event && notificationCallback) {
    // Emit to callback with options
    notificationCallback(event, options);
  }

  // Move to processed (even if parsing failed, to avoid retry loops)
  moveToProcessed(filePath);
}

/**
 * Process any existing pending notifications on startup (silently)
 * Returns the count of processed notifications so caller can update tray once
 */
function processExistingNotifications(): number {
  try {
    if (!fs.existsSync(PENDING_DIR)) {
      return 0;
    }

    const files = fs.readdirSync(PENDING_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    if (jsonFiles.length > 0) {
      console.log(`[NotificationWatcher] Processing ${jsonFiles.length} existing notifications (silent mode)`);

      for (const filename of jsonFiles) {
        processNotificationFile(path.join(PENDING_DIR, filename), { silent: true });
      }
    }

    return jsonFiles.length;
  } catch (error) {
    console.error('[NotificationWatcher] Error processing existing notifications:', error);
    return 0;
  }
}

/**
 * Start watching for notification events
 * Returns the count of existing notifications processed (silently) at startup
 */
export function startNotificationWatcher(
  onNotification: (event: SessionNotificationEvent, options?: { silent?: boolean }) => void
): number {
  // Ensure directories exist
  ensureNotificationDirs();

  // Store callback
  notificationCallback = onNotification;

  // Process any existing notifications first (silently)
  const existingCount = processExistingNotifications();

  // Start watching
  watcher = watch(PENDING_DIR, {
    persistent: true,
    ignoreInitial: true,  // We already processed existing files
    awaitWriteFinish: {
      stabilityThreshold: 100,  // Wait for write to complete
      pollInterval: 50,
    },
  });

  watcher.on('add', (filePath) => {
    // New files get full processing (not silent)
    processNotificationFile(filePath);
  });

  watcher.on('error', (error) => {
    console.error('[NotificationWatcher] Watcher error:', error);
  });

  console.log(`[NotificationWatcher] Started watching: ${PENDING_DIR}`);

  return existingCount;
}

/**
 * Stop the notification watcher
 */
export function stopNotificationWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
    notificationCallback = null;
    console.log('[NotificationWatcher] Stopped');
  }
}

/**
 * Clean up old processed notifications (keep last 7 days)
 */
export function cleanupOldNotifications(maxAgeDays: number = 7): number {
  let cleaned = 0;

  try {
    if (!fs.existsSync(PROCESSED_DIR)) {
      return 0;
    }

    const files = fs.readdirSync(PROCESSED_DIR);
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

    for (const filename of files) {
      const filePath = path.join(PROCESSED_DIR, filename);
      const stats = fs.statSync(filePath);

      if (stats.mtime.getTime() < cutoff) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[NotificationWatcher] Cleaned up ${cleaned} old notifications`);
    }
  } catch (error) {
    console.error('[NotificationWatcher] Error cleaning up old notifications:', error);
  }

  return cleaned;
}

/**
 * Get paths for external use
 */
export function getNotificationPaths() {
  return {
    base: NOTIFICATIONS_DIR,
    pending: PENDING_DIR,
    processed: PROCESSED_DIR,
  };
}

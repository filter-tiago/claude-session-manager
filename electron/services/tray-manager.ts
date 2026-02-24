/**
 * Tray Manager Service
 *
 * Manages system tray icon state and visual feedback:
 * - Dynamic icon generation (colored circles)
 * - State management (idle, active, attention, error)
 * - Pulse animation for attention state
 * - macOS dock badge for pending attention items
 *
 * Icon States:
 * | State     | Color  | Hex     | Description                    |
 * |-----------|--------|---------|--------------------------------|
 * | idle      | gray   | #6b7280 | No active sessions             |
 * | active    | green  | #22c55e | Sessions running normally      |
 * | attention | orange | #f97316 | Blocked/needs attention        |
 * | error     | red    | #ef4444 | Crash detected                 |
 */

import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import type { NativeImage } from 'electron';
import type { ProcessedNotification } from '../../src/types/notifications';
import zlib from 'zlib';

// Tray state types
export type TrayState = 'idle' | 'active' | 'attention' | 'error';

// Icon colors
const ICON_COLORS: Record<TrayState, string> = {
  idle: '#6b7280',
  active: '#22c55e',
  attention: '#f97316',
  error: '#ef4444',
};

// Module state
let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let currentState: TrayState = 'idle';
let pulseInterval: NodeJS.Timeout | null = null;
let isPulseDim = false;
let pendingCount = 0;

// Icon cache to avoid regeneration
const iconCache: Map<string, NativeImage> = new Map();

/**
 * Generate a circular icon as PNG data
 * Creates a simple filled circle with the specified color
 */
function generateIconPNG(color: string, size: number, dimmed = false): Buffer {
  // Apply dimming for pulse animation
  const finalColor = dimmed ? adjustBrightness(color, 0.5) : color;

  // Parse hex color
  const r = parseInt(finalColor.slice(1, 3), 16);
  const g = parseInt(finalColor.slice(3, 5), 16);
  const b = parseInt(finalColor.slice(5, 7), 16);

  // Create PNG manually (minimal valid PNG with RGBA data)
  // This is a simple approach - create raw RGBA pixels and encode as PNG

  const pixels = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const radius = (size / 2) - 1; // Leave 1px border

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - center + 0.5;
      const dy = y - center + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Inside circle - anti-alias the edge
        const alpha = dist > radius - 1 ? Math.max(0, (radius - dist)) * 255 : 255;
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = Math.round(alpha);
      } else {
        // Outside circle - transparent
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      }
    }
  }

  // Encode as PNG using a minimal encoder
  return encodePNG(pixels, size, size);
}

/**
 * Minimal PNG encoder
 * Creates a valid PNG file from raw RGBA pixel data
 */
function encodePNG(pixels: Buffer, width: number, height: number): Buffer {
  // PNG structure: signature + IHDR + IDAT + IEND

  // Signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // Length
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr.writeUInt8(8, 16);  // Bit depth
  ihdr.writeUInt8(6, 17);  // Color type (RGBA)
  ihdr.writeUInt8(0, 18);  // Compression
  ihdr.writeUInt8(0, 19);  // Filter
  ihdr.writeUInt8(0, 20);  // Interlace
  const ihdrCrc = crc32(ihdr.subarray(4, 21));
  ihdr.writeUInt32BE(ihdrCrc, 21);

  // Prepare raw data with filter bytes (0 = no filter for each row)
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // Filter type
    pixels.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  // Compress with deflate
  const compressed = zlib.deflateSync(rawData, { level: 9 });

  // IDAT chunk
  const idat = Buffer.alloc(12 + compressed.length);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  idat.writeUInt32BE(idatCrc, 8 + compressed.length);

  // IEND chunk
  const iend = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

/**
 * CRC32 calculation for PNG chunks
 */
function crc32(data: Buffer): number {
  let crc = 0xFFFFFFFF;
  const table = getCrc32Table();

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

let crc32Table: number[] | null = null;

function getCrc32Table(): number[] {
  if (crc32Table) return crc32Table;

  crc32Table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    crc32Table[n] = c;
  }
  return crc32Table;
}

/**
 * Adjust color brightness
 */
function adjustBrightness(hex: string, factor: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Get or create cached icon for a state
 */
function getIcon(state: TrayState, dimmed = false): NativeImage {
  const cacheKey = `${state}-${dimmed ? 'dim' : 'normal'}`;

  if (!iconCache.has(cacheKey)) {
    const color = ICON_COLORS[state];

    // Generate 16x16 for normal and 32x32 for @2x (retina)
    const png16 = generateIconPNG(color, 16, dimmed);
    const png32 = generateIconPNG(color, 32, dimmed);

    // Create native image with both resolutions
    const image = nativeImage.createFromBuffer(png16, {
      width: 16,
      height: 16,
      scaleFactor: 1.0,
    });

    // Add 2x version for retina displays
    image.addRepresentation({
      buffer: png32,
      width: 32,
      height: 32,
      scaleFactor: 2.0,
    });

    // Mark as template image on macOS for proper menu bar appearance
    if (process.platform === 'darwin') {
      image.setTemplateImage(false); // Use colored version, not template
    }

    iconCache.set(cacheKey, image);
  }

  return iconCache.get(cacheKey)!;
}

/**
 * Update the tray icon to reflect current state
 */
function updateTrayIcon(): void {
  if (!tray) return;

  const icon = getIcon(currentState, isPulseDim);
  tray.setImage(icon);
}

/**
 * Start pulse animation for attention state
 */
function startPulse(): void {
  if (pulseInterval) return;

  pulseInterval = setInterval(() => {
    isPulseDim = !isPulseDim;
    updateTrayIcon();
  }, 500);

  console.log('[TrayManager] Started pulse animation');
}

/**
 * Stop pulse animation
 */
function stopPulse(): void {
  if (pulseInterval) {
    clearInterval(pulseInterval);
    pulseInterval = null;
    isPulseDim = false;
    updateTrayIcon();
    console.log('[TrayManager] Stopped pulse animation');
  }
}

/**
 * Update macOS dock badge
 */
function updateDockBadge(count: number): void {
  if (process.platform !== 'darwin') return;

  if (count > 0) {
    app.dock?.setBadge(count.toString());
  } else {
    app.dock?.setBadge('');
  }
}

/**
 * Initialize the tray manager
 */
export function initTrayManager(
  trayInstance: Tray,
  window: BrowserWindow | null,
  quitCallback: () => void
): void {
  tray = trayInstance;
  mainWindow = window;

  // Set initial icon
  updateTrayIcon();

  // Build context menu
  updateContextMenu(quitCallback);

  // Set up click handler
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });

  console.log('[TrayManager] Initialized');
}

/**
 * Update the window reference
 */
export function setTrayWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}

/**
 * Build and update the context menu
 */
function updateContextMenu(quitCallback: () => void): void {
  if (!tray) return;

  const menuItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Show Session Manager',
      click: () => mainWindow?.show(),
    },
    { type: 'separator' },
  ];

  // Add state indicator
  const stateLabels: Record<TrayState, string> = {
    idle: 'No active sessions',
    active: 'Sessions running',
    attention: `${pendingCount} need${pendingCount === 1 ? 's' : ''} attention`,
    error: 'Error detected',
  };

  menuItems.push({
    label: stateLabels[currentState],
    enabled: false,
  });

  if (pendingCount > 0) {
    menuItems.push({
      label: 'Clear All Notifications',
      click: () => {
        // Emit event to clear notifications
        mainWindow?.webContents.send('clear-all-notifications');
      },
    });
  }

  menuItems.push(
    { type: 'separator' },
    {
      label: 'Quit',
      click: quitCallback,
    }
  );

  tray.setContextMenu(Menu.buildFromTemplate(menuItems));
}

/**
 * Set the tray state based on pending notifications
 * Called by NotificationManager when notifications change
 */
export function setTrayState(
  state: TrayState,
  count: number = 0,
  quitCallback?: () => void
): void {
  const stateChanged = currentState !== state;
  const countChanged = pendingCount !== count;

  currentState = state;
  pendingCount = count;

  // Update icon
  updateTrayIcon();

  // Handle pulse animation
  if (state === 'attention') {
    startPulse();
  } else {
    stopPulse();
  }

  // Update dock badge
  updateDockBadge(count);

  // Update tooltip
  if (tray) {
    const tooltips: Record<TrayState, string> = {
      idle: 'Claude Session Manager',
      active: 'Claude Session Manager - Sessions active',
      attention: `Claude Session Manager - ${count} need${count === 1 ? 's' : ''} attention`,
      error: 'Claude Session Manager - Error detected',
    };
    tray.setToolTip(tooltips[state]);
  }

  // Update context menu if we have a quit callback
  if (quitCallback) {
    updateContextMenu(quitCallback);
  }

  if (stateChanged || countChanged) {
    console.log(`[TrayManager] State: ${state}, count: ${count}`);
  }
}

/**
 * Determine appropriate tray state from notifications
 */
export function determineTrayState(notifications: ProcessedNotification[]): {
  state: TrayState;
  count: number;
} {
  // Count notifications needing attention
  const attentionCount = notifications.filter(
    n => n.category === 'needs_attention' || n.category === 'error'
  ).length;

  const hasError = notifications.some(n => n.category === 'error');
  const hasAttention = notifications.some(n => n.category === 'needs_attention');

  // Determine state priority: error > attention > active > idle
  let state: TrayState = 'idle';

  if (hasError) {
    state = 'error';
  } else if (hasAttention) {
    state = 'attention';
  } else if (notifications.length > 0) {
    state = 'active';
  }

  return { state, count: attentionCount };
}

/**
 * Update tray from notification list
 * Convenience method that combines determineTrayState and setTrayState
 */
export function updateTrayFromNotifications(
  notifications: ProcessedNotification[],
  quitCallback?: () => void
): void {
  const { state, count } = determineTrayState(notifications);
  setTrayState(state, count, quitCallback);
}

/**
 * Show the main window and navigate to a specific session
 */
export function showSessionInApp(sessionId: string): void {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('select-session', sessionId);
  }
}

/**
 * Get current tray state
 */
export function getCurrentTrayState(): TrayState {
  return currentState;
}

/**
 * Get pending count
 */
export function getPendingCount(): number {
  return pendingCount;
}

/**
 * Cleanup on app quit
 */
export function cleanupTrayManager(): void {
  stopPulse();
  iconCache.clear();
  console.log('[TrayManager] Cleaned up');
}

/**
 * Pre-generate all icons (call on startup for better responsiveness)
 */
export function preloadIcons(): void {
  for (const state of Object.keys(ICON_COLORS) as TrayState[]) {
    getIcon(state, false);
    getIcon(state, true);
  }
  console.log('[TrayManager] Icons preloaded');
}

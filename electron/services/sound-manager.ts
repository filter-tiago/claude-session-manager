/**
 * Sound Manager Service
 *
 * Cross-platform sound playback for notifications.
 * Uses native system commands for maximum compatibility:
 * - macOS: afplay
 * - Linux: paplay (PulseAudio) or aplay (ALSA)
 * - Windows: PowerShell
 *
 * Sound files are simple generated tones bundled with the app.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type SoundType = 'success' | 'attention' | 'error' | 'subtle';

// Sound file mapping
const SOUND_FILES: Record<SoundType, string> = {
  success: 'success.wav',
  attention: 'attention.wav',
  error: 'error.wav',
  subtle: 'subtle.wav',
};

// Default volume (0.0 - 1.0)
let globalVolume = 0.7;
let soundsEnabled = true;

/**
 * Get the sounds directory path
 * In development: electron/sounds/
 * In production: resources/sounds/
 */
function getSoundsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'sounds');
  }
  // Development - sounds directory next to electron folder
  return path.join(__dirname, '..', 'sounds');
}

/**
 * Check if sound files exist, generate if missing
 */
export function ensureSoundFiles(): void {
  const soundsDir = getSoundsDir();

  // Create sounds directory if needed
  if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir, { recursive: true });
    console.log(`[SoundManager] Created sounds directory: ${soundsDir}`);
  }

  // Check each sound file
  for (const [type, filename] of Object.entries(SOUND_FILES)) {
    const filePath = path.join(soundsDir, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`[SoundManager] Generating sound file: ${filename}`);
      generateSoundFile(type as SoundType, filePath);
    }
  }
}

/**
 * Generate a simple WAV file with a tone
 * Each sound type has different characteristics:
 * - success: pleasant two-tone ascending (C5 → E5)
 * - attention: two quick beeps (A4)
 * - error: descending tone (E4 → C4)
 * - subtle: soft single beep (G4)
 */
function generateSoundFile(type: SoundType, filePath: string): void {
  const sampleRate = 44100;

  // Sound characteristics by type
  const configs: Record<SoundType, { freqs: number[]; durations: number[]; amplitude: number }> = {
    success: { freqs: [523.25, 659.25], durations: [0.15, 0.2], amplitude: 0.3 },
    attention: { freqs: [440, 440], durations: [0.1, 0.1], amplitude: 0.4 },
    error: { freqs: [329.63, 261.63], durations: [0.2, 0.3], amplitude: 0.35 },
    subtle: { freqs: [392], durations: [0.1], amplitude: 0.2 },
  };

  const config = configs[type];
  const samples: number[] = [];

  // Generate samples for each tone
  for (let i = 0; i < config.freqs.length; i++) {
    const freq = config.freqs[i];
    const duration = config.durations[i];
    const numSamples = Math.floor(sampleRate * duration);

    for (let j = 0; j < numSamples; j++) {
      // Sine wave with envelope
      const t = j / sampleRate;
      const envelope = Math.min(1, Math.min(j / 500, (numSamples - j) / 500)); // Attack/release
      const sample = Math.sin(2 * Math.PI * freq * t) * config.amplitude * envelope;
      samples.push(sample);
    }

    // Add small gap between tones (except for last)
    if (i < config.freqs.length - 1) {
      const gapSamples = Math.floor(sampleRate * 0.05);
      for (let j = 0; j < gapSamples; j++) {
        samples.push(0);
      }
    }
  }

  // Convert to 16-bit PCM
  const buffer = Buffer.alloc(44 + samples.length * 2);

  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20);  // AudioFormat (PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (mono)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  buffer.writeUInt16LE(2, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);

  // Write samples
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
  console.log(`[SoundManager] Generated: ${path.basename(filePath)}`);
}

/**
 * Play a sound using the appropriate system command
 */
export function playSound(type: SoundType): void {
  if (!soundsEnabled) {
    return;
  }

  const soundsDir = getSoundsDir();
  const filePath = path.join(soundsDir, SOUND_FILES[type]);

  if (!fs.existsSync(filePath)) {
    console.warn(`[SoundManager] Sound file not found: ${filePath}`);
    return;
  }

  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      // macOS: afplay with volume (0.0 - 1.0)
      spawn('afplay', ['-v', String(globalVolume), filePath], {
        stdio: 'ignore',
        detached: true,
      }).unref();
    } else if (platform === 'linux') {
      // Linux: try paplay first (PulseAudio), fall back to aplay (ALSA)
      const paplay = spawn('paplay', [filePath], { stdio: 'ignore', detached: true });
      paplay.on('error', () => {
        // Fall back to aplay
        spawn('aplay', ['-q', filePath], { stdio: 'ignore', detached: true }).unref();
      });
      paplay.unref();
    } else if (platform === 'win32') {
      // Windows: PowerShell
      const cmd = `(New-Object Media.SoundPlayer '${filePath}').PlaySync()`;
      spawn('powershell', ['-Command', cmd], {
        stdio: 'ignore',
        detached: true,
        windowsHide: true,
      }).unref();
    }

    console.log(`[SoundManager] Playing: ${type}`);
  } catch (error) {
    console.error(`[SoundManager] Error playing sound:`, error);
  }
}

/**
 * Set the global volume (0.0 - 1.0)
 */
export function setVolume(volume: number): void {
  globalVolume = Math.max(0, Math.min(1, volume));
  console.log(`[SoundManager] Volume set to ${Math.floor(globalVolume * 100)}%`);
}

/**
 * Get the current volume
 */
export function getVolume(): number {
  return globalVolume;
}

/**
 * Enable or disable sounds globally
 */
export function setSoundsEnabled(enabled: boolean): void {
  soundsEnabled = enabled;
  console.log(`[SoundManager] Sounds ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Check if sounds are enabled
 */
export function isSoundsEnabled(): boolean {
  return soundsEnabled;
}

/**
 * Get available sound types
 */
export function getSoundTypes(): SoundType[] {
  return Object.keys(SOUND_FILES) as SoundType[];
}

/**
 * Test all sounds (for settings UI)
 */
export function testSound(type: SoundType): void {
  playSound(type);
}

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SoundType, NotificationConfig } from '../types/electron';

interface QuietHours {
  enabled: boolean;
  start: string; // HH:mm format
  end: string;   // HH:mm format
}

const SOUND_DESCRIPTIONS: Record<SoundType, string> = {
  success: 'Task completed successfully',
  attention: 'Needs your attention (blocked, waiting)',
  error: 'Error or crash detected',
  subtle: 'Minor updates and events',
};

export function NotificationSettingsPage() {
  const navigate = useNavigate();

  // Sound settings
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const [soundTypes, setSoundTypes] = useState<SoundType[]>([]);
  const [playingSound, setPlayingSound] = useState<SoundType | null>(null);

  // Notification settings
  const [nativeNotifications, setNativeNotifications] = useState(true);
  const [inAppToasts, setInAppToasts] = useState(true);
  const [trayBadge, setTrayBadge] = useState(true);

  // Quiet hours (stored locally, not enforced yet)
  const [quietHours, setQuietHours] = useState<QuietHours>({
    enabled: false,
    start: '22:00',
    end: '08:00',
  });

  // Status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Load initial settings
  const loadSettings = useCallback(async () => {
    try {
      const [
        enabled,
        currentVolume,
        types,
        config,
      ] = await Promise.all([
        window.electronAPI.isSoundsEnabled(),
        window.electronAPI.getVolume(),
        window.electronAPI.getSoundTypes(),
        window.electronAPI.getNotificationConfig(),
      ]);

      setSoundsEnabled(enabled);
      setVolume(currentVolume);
      setSoundTypes(types);
      setNativeNotifications(config.nativeNotifications);
      setInAppToasts(config.inAppToasts);
      setTrayBadge(config.trayBadge);
      setError(null);

      // Load quiet hours from localStorage (not persisted to backend yet)
      const savedQuietHours = localStorage.getItem('notification-quiet-hours');
      if (savedQuietHours) {
        try {
          setQuietHours(JSON.parse(savedQuietHours));
        } catch {
          // Ignore parse errors
        }
      }
    } catch (err) {
      setError(`Failed to load settings: ${err}`);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Save handlers
  const handleSoundsEnabledChange = async (enabled: boolean) => {
    setSoundsEnabled(enabled);
    await window.electronAPI.setSoundsEnabled(enabled);
  };

  const handleVolumeChange = async (newVolume: number) => {
    setVolume(newVolume);
    await window.electronAPI.setVolume(newVolume);
  };

  const handleTestSound = async (type: SoundType) => {
    setPlayingSound(type);
    await window.electronAPI.testSound(type);
    setTimeout(() => setPlayingSound(null), 1000);
  };

  const handleConfigChange = async (updates: Partial<NotificationConfig>) => {
    setSaveStatus('saving');
    try {
      const result = await window.electronAPI.configureNotifications(updates);
      if (result.success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setError('Failed to save notification settings');
      }
    } catch (err) {
      setSaveStatus('error');
      setError(`Failed to save: ${err}`);
    }
  };

  const handleQuietHoursChange = (updates: Partial<QuietHours>) => {
    const newQuietHours = { ...quietHours, ...updates };
    setQuietHours(newQuietHours);
    localStorage.setItem('notification-quiet-hours', JSON.stringify(newQuietHours));
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="h-12 bg-[var(--bg-secondary)] flex items-center justify-between px-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mr-2"
            title="Back to sessions"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <svg
            className="w-5 h-5 text-[var(--text-secondary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <h1 className="text-base font-semibold text-[var(--text-primary)]">
            Notification Settings
          </h1>
        </div>

        <button
          onClick={loadSettings}
          className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
          title="Refresh settings"
        >
          <svg
            className="w-4 h-4 text-[var(--text-secondary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Sound Settings Card */}
        <section className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              Sound Settings
            </h2>
          </div>

          <div className="p-4 space-y-4">
            {/* Enable Sounds Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">Enable Sounds</div>
                <div className="text-xs text-[var(--text-secondary)]">Play audio notifications for events</div>
              </div>
              <Toggle
                enabled={soundsEnabled}
                onChange={handleSoundsEnabledChange}
              />
            </div>

            {/* Volume Slider */}
            <div className={soundsEnabled ? '' : 'opacity-50 pointer-events-none'}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-[var(--text-primary)]">Volume</div>
                <div className="text-xs text-[var(--text-secondary)]">{Math.round(volume * 100)}%</div>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
                />
                <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </div>
            </div>

            {/* Sound Test Buttons */}
            <div className={soundsEnabled ? '' : 'opacity-50 pointer-events-none'}>
              <div className="text-sm font-medium text-[var(--text-primary)] mb-3">Test Sounds</div>
              <div className="grid grid-cols-2 gap-2">
                {soundTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => handleTestSound(type)}
                    disabled={playingSound === type}
                    className={`flex items-center justify-between px-3 py-2 rounded border transition-colors ${
                      playingSound === type
                        ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white'
                        : 'bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
                    }`}
                  >
                    <div className="text-left">
                      <div className="text-sm font-medium capitalize">{type}</div>
                      <div className={`text-xs ${playingSound === type ? 'text-white/80' : 'text-[var(--text-secondary)]'}`}>
                        {SOUND_DESCRIPTIONS[type]}
                      </div>
                    </div>
                    {playingSound === type ? (
                      <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Display Settings Card */}
        <section className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Display Settings
            </h2>
          </div>

          <div className="p-4 space-y-4">
            {/* Native Notifications */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">Native Notifications</div>
                <div className="text-xs text-[var(--text-secondary)]">Show macOS notification center alerts</div>
              </div>
              <Toggle
                enabled={nativeNotifications}
                onChange={(enabled) => {
                  setNativeNotifications(enabled);
                  handleConfigChange({ nativeNotifications: enabled });
                }}
              />
            </div>

            {/* In-App Toasts */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">In-App Toasts</div>
                <div className="text-xs text-[var(--text-secondary)]">Show toast notifications inside the app</div>
              </div>
              <Toggle
                enabled={inAppToasts}
                onChange={(enabled) => {
                  setInAppToasts(enabled);
                  handleConfigChange({ inAppToasts: enabled });
                }}
              />
            </div>

            {/* Tray Badge */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">Tray Badge</div>
                <div className="text-xs text-[var(--text-secondary)]">Show notification count on dock and tray icon</div>
              </div>
              <Toggle
                enabled={trayBadge}
                onChange={(enabled) => {
                  setTrayBadge(enabled);
                  handleConfigChange({ trayBadge: enabled });
                }}
              />
            </div>
          </div>
        </section>

        {/* Quiet Hours Card */}
        <section className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              Quiet Hours
              <span className="text-xs text-[var(--warning)] bg-[var(--warning)]/10 px-2 py-0.5 rounded">Coming Soon</span>
            </h2>
          </div>

          <div className="p-4 space-y-4">
            {/* Enable Quiet Hours */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">Enable Quiet Hours</div>
                <div className="text-xs text-[var(--text-secondary)]">Silence notifications during specified times</div>
              </div>
              <Toggle
                enabled={quietHours.enabled}
                onChange={(enabled) => handleQuietHoursChange({ enabled })}
              />
            </div>

            {/* Time Range */}
            <div className={quietHours.enabled ? '' : 'opacity-50 pointer-events-none'}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={quietHours.start}
                    onChange={(e) => handleQuietHoursChange({ start: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={quietHours.end}
                    onChange={(e) => handleQuietHoursChange({ end: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-2">
                Notifications will be silenced from {quietHours.start} to {quietHours.end}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="h-12 bg-[var(--bg-secondary)] flex items-center justify-between px-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-2 text-xs text-[var(--error)]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="truncate max-w-md">{error}</span>
            </div>
          )}
          {saveStatus === 'saved' && (
            <div className="flex items-center gap-2 text-xs text-[var(--success)]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Settings saved</span>
            </div>
          )}
          {saveStatus === 'saving' && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Saving...</span>
            </div>
          )}
        </div>

        <div className="text-xs text-[var(--text-secondary)]">
          Changes are saved automatically
        </div>
      </footer>
    </div>
  );
}

// Toggle Switch Component
function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}


import MixerChannel from './MixerChannel';
import Oscilloscope from '../components/Oscilloscope';
import type { MixerConfig } from './mixerState';
import type { Track } from '../engine';

interface MixerPanelProps {
  tracks: Track[];
  mixerConfig: MixerConfig;
  onFaderChange: (channelId: string, db: number) => void;
  onPanChange: (channelId: string, pan: number) => void;
  onMuteToggle: (trackId: string) => void;
  onSoloToggle: (trackId: string) => void;
  onRecToggle: (channelId: string) => void;
  /** Master oscilloscope state */
  scopeEnabled: boolean;
  scopeMode: 'waveform' | 'spectrum' | 'sonagram';
  onScopeModeChange: (mode: 'waveform' | 'spectrum' | 'sonagram') => void;
  scopePlaying: boolean;
}

/**
 * Mixer Panel — the final audio stage before Master Bus.
 * Placed below the instrument tracks.
 *
 * Layout:
 *   [Kick][Snare][Ghost?][Hat][Bass]  [Master]
 *
 * Each channel: Name, Peak Meter, Fader (+12 to -∞), Pan, M/S/R buttons.
 * Master channel additionally shows the master oscilloscope.
 */
export default function MixerPanel({
  tracks,
  mixerConfig,
  onFaderChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onRecToggle,
  scopeEnabled,
  scopeMode,
  onScopeModeChange,
  scopePlaying,
}: MixerPanelProps) {
  // Compute mute/solo state from tracks
  const hasSoloGroup = tracks.some((t) => t.solo);
  const muteState = (id: string) => {
    if (id === 'master') return false;
    const track = tracks.find((t) => t.id === id);
    return !!track?.mute;
  };
  const soloState = (id: string) => {
    if (id === 'master') return false;
    const track = tracks.find((t) => t.id === id);
    return !!track?.solo;
  };

  // Split channels into instrument channels + master
  const instrumentChannels = mixerConfig.filter((ch) => ch.id !== 'master');
  const masterChannel = mixerConfig.find((ch) => ch.id === 'master');

  return (
    <section className="mixer-panel" aria-label="Mixer">
      <div className="mixer-header">
        <h2 className="mixer-title">Mixer</h2>
      </div>

      <div className="mixer-channels">
        {instrumentChannels.map((ch) => {
          return (
            <MixerChannel
              key={ch.id}
              channel={ch}
              isMaster={false}
              muted={muteState(ch.id)}
              soloed={soloState(ch.id)}
              hasSoloGroup={hasSoloGroup}
              onFaderChange={(db) => onFaderChange(ch.id, db)}
              onPanChange={(pan) => onPanChange(ch.id, pan)}
              onMuteToggle={() => onMuteToggle(ch.id)}
              onSoloToggle={() => onSoloToggle(ch.id)}
              onRecToggle={() => onRecToggle(ch.id)}
            />
          );
        })}

        {/* Master channel */}
        {masterChannel && (
          <MixerChannel
            key="master"
            channel={masterChannel}
            isMaster={true}
            muted={false}
            soloed={false}
            hasSoloGroup={false}
            onFaderChange={(db) => onFaderChange('master', db)}
            onPanChange={(pan) => onPanChange('master', pan)}
            onMuteToggle={() => {}}
            onSoloToggle={() => {}}
            onRecToggle={() => onRecToggle('master')}
          />
        )}
      </div>

      {/* Master oscilloscope — moved from transport section into the mixer */}
      {scopeEnabled && masterChannel && (
        <div className="mixer-scope-section">
          <div className="mixer-scope-header">
            <span className="mixer-scope-label">Master Scope</span>
          </div>
          <div className="mixer-scope-modes">
            <label className="scope-mode-toggle">
              <input
                type="radio"
                name="mixer-scope-mode"
                value="waveform"
                checked={scopeMode === 'waveform'}
                onChange={() => onScopeModeChange('waveform')}
              />
              Wave
            </label>
            <label className="scope-mode-toggle">
              <input
                type="radio"
                name="mixer-scope-mode"
                value="spectrum"
                checked={scopeMode === 'spectrum'}
                onChange={() => onScopeModeChange('spectrum')}
              />
              Spec
            </label>
            <label className="scope-mode-toggle">
              <input
                type="radio"
                name="mixer-scope-mode"
                value="sonagram"
                checked={scopeMode === 'sonagram'}
                onChange={() => onScopeModeChange('sonagram')}
              />
              Sonagram
            </label>
          </div>
          <Oscilloscope
            active={scopeEnabled && scopePlaying}
            mode={scopeMode}
            color="#88cc88"
            height={120}
          />
        </div>
      )}
    </section>
  );
}

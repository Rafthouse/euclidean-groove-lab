
import { useCallback, useState } from 'react';
import MixerChannel from './MixerChannel';
import FxRackPanel from './FxRackPanel';
import Oscilloscope from '../components/Oscilloscope';
import type { MixerConfig } from './mixerState';
import type { FxSlot } from './fxTypes';
import type { Track } from '../engine';

interface MixerPanelProps {
  tracks: Track[];
  mixerConfig: MixerConfig;
  onFaderChange: (channelId: string, db: number) => void;
  onPanChange: (channelId: string, pan: number) => void;
  onMuteToggle: (trackId: string) => void;
  onSoloToggle: (trackId: string) => void;
  onRecToggle: (channelId: string) => void;
  /** Update a channel's FX chain (state + audio). */
  onFxChainChange: (channelId: string, chain: FxSlot[]) => void;
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
 * Each channel: Name, Peak Meter, Fader, Pan, M/S/R/FX buttons.
 * Master channel includes the oscilloscope.
 * FX Rack opens as an overlay popup per channel.
 */
export default function MixerPanel({
  tracks,
  mixerConfig,
  onFaderChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onRecToggle,
  onFxChainChange,
  scopeEnabled,
  scopeMode,
  onScopeModeChange,
  scopePlaying,
}: MixerPanelProps) {
  // ── FX Rack overlay state ──────────────────────────────────────
  const [fxRackOpen, setFxRackOpen] = useState<string | null>(null);

  const handleFxButton = useCallback((channelId: string) => {
    setFxRackOpen(channelId);
  }, []);

  const handleCloseFxRack = useCallback(() => {
    setFxRackOpen(null);
  }, []);

  // ── Mute/Solo from tracks ──────────────────────────────────────
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

  // Filter channels — hide ghost when disabled
  const ghostTrack = tracks.find((t) => t.id === 'snare');
  const ghostEnabled = ghostTrack?.ghost?.enabled === true;
  const instrumentChannels = mixerConfig.filter(
    (ch) => ch.id !== 'master' && (ch.id !== 'ghost' || ghostEnabled)
  );
  const masterChannel = mixerConfig.find((ch) => ch.id === 'master');

  // Find the channel that has its FX rack open
  const fxRackChannel = fxRackOpen
    ? mixerConfig.find((ch) => ch.id === fxRackOpen)
    : null;

  return (
    <section className="mixer-panel" aria-label="Mixer">
      <div className="mixer-header">
        <h2 className="mixer-title">Mixer</h2>
      </div>

      <div className="mixer-channels">
        {instrumentChannels.map((ch) => (
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
            onFxRackOpen={() => handleFxButton(ch.id)}
          />
        ))}

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
            onFxRackOpen={() => handleFxButton('master')}
          />
        )}
      </div>

      {/* Master oscilloscope */}
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

      {/* FX Rack overlay */}
      {fxRackChannel && (
        <FxRackPanel
          channelName={fxRackChannel.name}
          channelId={fxRackChannel.id}
          fxChain={fxRackChannel.fxChain}
          onUpdateChain={onFxChainChange}
          onClose={handleCloseFxRack}
          availableSidechainSources={
            fxRackChannel.id !== 'master'
              ? ['kick', 'snare', 'ghost', 'hat', 'bass']
              : undefined
          }
        />
      )}
    </section>
  );
}

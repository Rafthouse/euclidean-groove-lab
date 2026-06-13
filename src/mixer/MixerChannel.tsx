import { useMemo } from 'react';
import ChannelFader from './ChannelFader';
import type { MixerChannelState } from './mixerState';

interface MixerChannelProps {
  channel: MixerChannelState;
  isMaster: boolean;
  muted: boolean;
  soloed: boolean;
  hasSoloGroup: boolean;
  /** Analyser data for the peak meter, if available. Float32Array of amplitude per bin (0–1). */
  analyserData?: Float32Array;
  /** Available track voice IDs that can be sidechain sources (master doesn't have one). */
  onFaderChange: (db: number) => void;
  onPanChange: (pan: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
  onRecToggle: () => void;
}

/**
 * Single mixer channel strip.
 * Professional DAW-style: name, peak meter, fader, pan, mute/solo/rec buttons.
 */
export default function MixerChannel({
  channel,
  isMaster,
  muted,
  soloed,
  hasSoloGroup,
  analyserData,
  onFaderChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onRecToggle,
}: MixerChannelProps) {
  const { name, faderDb, pan, rec } = channel;
  // hasSoloGroup is used by parent to determine dimming; keep for consistency
  void hasSoloGroup;

  // Compute current peak level (0–1) from analyser data
  const peakLevel = useMemo(() => {
    if (!analyserData || analyserData.length === 0) return 0;
    let max = 0;
    for (let i = 0; i < analyserData.length; i++) {
      const v = analyserData[i];
      if (v > max) max = v;
    }
    return max;
  }, [analyserData]);

  // Compute peak dB for display
  const peakDb = peakLevel <= 0.001 ? -60 : 20 * Math.log10(peakLevel);
  const clip = peakLevel >= 0.98;

  return (
    <div className={`mixer-channel${isMaster ? ' mixer-master' : ''}`}>
      {/* Channel name */}
      <div className="mixer-channel-name">{name}</div>

      {/* Peak meter — vertical bar */}
      <div className="mixer-peak-meter" title={`${peakDb.toFixed(1)} dB`}>
        <div className="mixer-peak-track">
          <div
            className={`mixer-peak-fill${clip ? ' mixer-peak-clip' : ''}${peakLevel > 0.8 ? ' mixer-peak-hot' : ''}`}
            style={{ height: `${Math.min(100, peakLevel * 100)}%` }}
          />
          {/* Clip indicator */}
          {clip && <div className="mixer-peak-clip-indicator">CLIP</div>}
        </div>
      </div>

      {/* Fader */}
      <ChannelFader
        value={faderDb}
        onChange={onFaderChange}
        label=""
      />

      {/* Pan knob (simple horizontal slider for now) */}
      {!isMaster && (
        <div className="mixer-pan">
          <span className="mixer-pan-label">Pan</span>
          <input
            type="range"
            min={-100}
            max={100}
            value={pan}
            onChange={(e) => onPanChange(parseInt(e.target.value))}
            className="mixer-pan-slider"
            aria-label={`${name} pan`}
          />
          <span className="mixer-pan-value">
            {pan === 0 ? 'C' : pan < 0 ? `L${-pan}` : `R${pan}`}
          </span>
        </div>
      )}

      {/* Mute / Solo / REC row */}
      <div className="mixer-controls">
        <button
          type="button"
          className={`mixer-btn mixer-mute${muted ? ' is-on' : ''}`}
          onClick={onMuteToggle}
          aria-pressed={muted}
          title={`Mute ${name}`}
        >
          M
        </button>
        <button
          type="button"
          className={`mixer-btn mixer-solo${soloed ? ' is-on' : ''}`}
          onClick={onSoloToggle}
          aria-pressed={soloed}
          title={`Solo ${name}`}
        >
          S
        </button>
        <button
          type="button"
          className={`mixer-btn mixer-rec${rec ? ' is-armed' : ''}`}
          onClick={onRecToggle}
          aria-pressed={rec}
          title={rec ? 'REC armed' : 'REC inactive'}
        >
          R
        </button>
      </div>
    </div>
  );
}

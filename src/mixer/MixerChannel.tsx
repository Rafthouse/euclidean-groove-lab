import { useMemo, useRef } from 'react';
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
 * Convert linear amplitude (0-1) to dBFS display value.
 * Maps the range for a professional meter: 0 dBFS at top, -60 at bottom,
 * with colour transitions at -6, -12, -18 dB.
 */
function amplitudeToMeterPercent(amplitude: number): number {
  if (amplitude <= 0) return 0;
  const dbFS = 20 * Math.log10(amplitude);
  // Map -60 dBFS → 0%, 0 dBFS → 100%
  const clamped = Math.max(-60, Math.min(0, dbFS));
  return ((clamped + 60) / 60) * 100;
}

const CLIP_HOLD_MS = 1000;

/**
 * Single mixer channel strip.
 * Professional DAW-style: name, peak meter (dBFS scale), fader, pan, mute/solo/rec.
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
  const dimmed = hasSoloGroup && !soloed && !isMaster;

  // Peak hold state (persists across renders via ref)
  const peakHoldRef = useRef(0);       // highest peak seen
  const peakHoldTimeRef = useRef(0);    // timestamp of peak hold
  const clipLatchRef = useRef(false);  // latched clip state
  const clipHoldTimeRef = useRef(0);
  const now = Date.now();

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

  // Update peak hold and clip latch
  if (peakLevel > peakHoldRef.current) {
    peakHoldRef.current = peakLevel;
    peakHoldTimeRef.current = now;
  }
  // Decay peak hold after 1.5s
  if (now - peakHoldTimeRef.current > 1500) {
    peakHoldRef.current = peakLevel;
    peakHoldTimeRef.current = now;
  }

  // Clip latching: hold CLIP indication for 1 second after level drops below 0 dBFS
  if (peakLevel >= 0.99) {
    clipLatchRef.current = true;
    clipHoldTimeRef.current = now;
  }
  if (clipLatchRef.current && now - clipHoldTimeRef.current > CLIP_HOLD_MS) {
    clipLatchRef.current = false;
  }

  const clip = clipLatchRef.current;
  const peakPercent = amplitudeToMeterPercent(peakLevel);
  const holdPercent = amplitudeToMeterPercent(peakHoldRef.current);
  const peakDbFS = peakLevel <= 0.001 ? '-∞' : (20 * Math.log10(peakLevel)).toFixed(1);

  // Determine meter colour zone
  const meterClass =
    clip ? 'mixer-peak-clip' :
    peakLevel >= 0.5 ? 'mixer-peak-hot' :  // -6 dBFS
    peakLevel >= 0.25 ? 'mixer-peak-warm' : // -12 dBFS
    peakLevel >= 0.125 ? 'mixer-peak-cool' : // -18 dBFS
    '';

  return (
    <div className={`mixer-channel${isMaster ? ' mixer-master' : ''}${dimmed ? ' mixer-dimmed' : ''}`}>
      {/* Channel name */}
      <div className="mixer-channel-name">{name}</div>

      {/* Peak meter — vertical bar, dBFS scale */}
      <div className="mixer-peak-meter" title={`${peakDbFS} dBFS`}>
        <div className="mixer-peak-track">
          {/* Reference lines */}
          <div className="mixer-peak-ref" style={{ bottom: '80%' }} title="-6 dB" />
          <div className="mixer-peak-ref" style={{ bottom: '60%' }} title="-12 dB" />
          <div className="mixer-peak-ref" style={{ bottom: '40%' }} title="-18 dB" />
          {/* Live fill */}
          <div
            className={`mixer-peak-fill ${meterClass}`}
            style={{ height: `${Math.min(100, peakPercent)}%` }}
          />
          {/* Peak hold dot */}
          <div
            className="mixer-peak-hold"
            style={{ bottom: `${Math.min(100, holdPercent)}%` }}
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

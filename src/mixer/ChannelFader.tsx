import { useRef, useCallback } from 'react';
import { FADER_MIN_DB, FADER_MAX_DB } from './mixerState';

interface ChannelFaderProps {
  value: number;            // dB
  onChange: (db: number) => void;
  height?: number;          // px
  label?: string;
}

/**
 * DAW-style vertical fader.
 * Range: +12 dB to -60 dB. Visual representation with dB scale marks.
 * Mouse drag changes dB value proportionally.
 */
export default function ChannelFader({
  value,
  onChange,
  height = 120,
  label,
}: ChannelFaderProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const dBToPercent = (db: number) => {
    const clamped = Math.max(FADER_MIN_DB, Math.min(FADER_MAX_DB, db));
    return ((clamped - FADER_MIN_DB) / (FADER_MAX_DB - FADER_MIN_DB)) * 100;
  };

  const percentToDb = (percent: number) => {
    const clamped = Math.max(0, Math.min(100, percent));
    return FADER_MIN_DB + (clamped / 100) * (FADER_MAX_DB - FADER_MIN_DB);
  };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    const rail = railRef.current;
    if (!rail) return;
    const rect = rail.getBoundingClientRect();
    const update = (clientY: number) => {
      const percent = 100 - ((clientY - rect.top) / rect.height) * 100;
      const db = percentToDb(Math.round(percent));
      onChange(db);
    };
    update(e.clientY);
    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      update(ev.clientY);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [onChange]);

  // Double-click to reset to 0 dB
  const handleDoubleClick = useCallback(() => {
    onChange(0);
  }, [onChange]);

  const percent = dBToPercent(value);

  // Format dB for display
  const displayDb = value <= FADER_MIN_DB ? '-∞' : (value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1));

  return (
    <div className="channel-fader">
      {label && <span className="fader-label">{label}</span>}
      <div
        ref={railRef}
        className="fader-rail"
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        style={{ height }}
      >
        {/* dB scale ticks */}
        <div className="fader-scale">
          {[12, 6, 0, -6, -12, -24, -40, -60].map((db) => (
            <div
              key={db}
              className="fader-tick"
              style={{ bottom: `${dBToPercent(db)}%` }}
            >
              <span className="fader-tick-label">{db === -60 ? '-∞' : db > 0 ? `+${db}` : db}</span>
            </div>
          ))}
        </div>
        {/* Track background */}
        <div className="fader-track">
          <div className="fader-fill" style={{ height: `${percent}%` }} />
        </div>
        {/* Thumb knob */}
        <div
          className="fader-thumb"
          style={{ bottom: `${percent}%`, transform: 'translateY(50%)' }}
        />
      </div>
      <span className="fader-value">{displayDb}</span>
    </div>
  );
}

import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Compact rotary knob. Vertical pointer drag changes the value (up = more);
 * the SVG arc sweeps ~270° between min and max. Pure presentational control —
 * no audio, no state beyond the drag origin. Used by the Ghost module.
 */

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Pixels of vertical drag for the full min→max sweep. */
  sensitivity?: number;
  /** Render the value (e.g. "200 Hz", "50%"). Defaults to the raw number. */
  format?: (v: number) => string;
  onChange: (value: number) => void;
}

const ARC_DEG = 270; // total sweep
const START_DEG = 135; // bottom-left start (135°), sweeping clockwise to 405°

export default function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  sensitivity = 160,
  format,
  onChange,
}: KnobProps) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);

  const norm = (value - min) / (max - min); // 0..1
  const angle = START_DEG + norm * ARC_DEG;
  const rad = (angle * Math.PI) / 180;
  // Indicator dot position on a r=13 circle inside a 36×36 viewbox.
  const cx = 18 + 13 * Math.cos(rad);
  const cy = 18 + 13 * Math.sin(rad);

  // Arc path from start to current angle (for the filled track).
  const arcRad = (deg: number) => (deg * Math.PI) / 180;
  const ax = (deg: number) => 18 + 14 * Math.cos(arcRad(deg));
  const ay = (deg: number) => 18 + 14 * Math.sin(arcRad(deg));
  const largeArc = norm * ARC_DEG > 180 ? 1 : 0;
  const trackPath = `M ${ax(START_DEG).toFixed(2)} ${ay(START_DEG).toFixed(2)} A 14 14 0 ${largeArc} 1 ${ax(angle).toFixed(2)} ${ay(angle).toFixed(2)}`;
  const fullPath = `M ${ax(START_DEG).toFixed(2)} ${ay(START_DEG).toFixed(2)} A 14 14 0 1 1 ${ax(START_DEG + ARC_DEG).toFixed(2)} ${ay(START_DEG + ARC_DEG).toFixed(2)}`;

  const apply = (clientY: number) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = d.startY - clientY; // up = positive
    const deltaValue = (dy / sensitivity) * (max - min);
    let next = d.startValue + deltaValue;
    next = Math.round(next / step) * step;
    next = Math.max(min, Math.min(max, next));
    if (next !== value) onChange(next);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startValue: value };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    apply(e.clientY);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  };

  return (
    <div
      className="knob"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      title={`${label}: ${format ? format(value) : value}`}
    >
      <svg className="knob-dial" viewBox="0 0 36 36" aria-hidden="true">
        <path className="knob-track" d={fullPath} />
        <path className="knob-fill" d={trackPath} />
        <circle className="knob-dot" cx={cx.toFixed(2)} cy={cy.toFixed(2)} r="2.4" />
      </svg>
      <span className="knob-label">{label}</span>
      <span className="knob-value">{format ? format(value) : value}</span>
    </div>
  );
}

/**
 * CircularKnob — premium rotary control for Euclidean Groove Spielzeug.
 *
 * Inspired by: FabFilter, Valhalla, u-he.
 *
 * Features:
 *   - Vertical drag (up = increase, down = decrease)
 *   - Shift = fine mode (10× slower)
 *   - Double-click = reset to default
 *   - Value displayed below knob
 *   - Custom arc track with value arc + background arc
 *   - Color theming via props
 *   - Size via `size` prop (default 48px)
 *
 * No sliders. Never. This is the only value input primitive.
 */

import { useCallback, useRef, useState } from 'react';

interface CircularKnobProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  label: string;
  unit?: string;
  /** Optional formatted value override. If omitted, auto-formats. */
  displayValue?: string;
  onChange: (value: number) => void;
  size?: number;
  color?: string;
  /** Arc range in degrees (default 270, centered bottom). */
  arcDeg?: number;
  /** Rotation offset in degrees (default -135 so range is bottom-center). */
  arcOffset?: number;
}

export default function CircularKnob({
  value, min, max, step = 0.01, defaultValue,
  label, unit, displayValue,
  onChange,
  size = 48,
  color = '#ff00c8',
  arcDeg = 270,
  arcOffset = -135,
}: CircularKnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const range = max - min;

  // Normalized 0..1
  const normalized = Math.max(0, Math.min(1, (value - min) / range));

  // Arc math
  const startAngle = (arcOffset * Math.PI) / 180;
  const totalArc = (arcDeg * Math.PI) / 180;
  const valueAngle = startAngle + totalArc * normalized;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const sw = Math.max(3, size * 0.08);

  // Background arc path
  const bgArc = describeArc(cx, cy, r, startAngle, startAngle + totalArc);
  // Value arc path
  const valArc = normalized > 0
    ? describeArc(cx, cy, r, startAngle, valueAngle)
    : '';

  // Format value
  const formatted = displayValue ?? (() => {
    if (unit === 's') return `${value.toFixed(2)}s`;
    if (unit === 'ms') return `${(value * 1000).toFixed(0)}ms`;
    if (unit === '%') return `${Math.round(value * 100)}%`;
    if (unit === 'Hz') return `${value.toFixed(1)}Hz`;
    if (step >= 1) return `${Math.round(value)}`;
    return `${value.toFixed(step >= 0.1 ? 1 : 2)}`;
  })();

  // Drag handler
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);

    const startY = e.clientY;
    const startValue = value;

    const onMove = (ev: PointerEvent) => {
      const delta = (startY - ev.clientY) * 0.3; // sensitivity
      const effectiveRange = ev.shiftKey ? range * 0.1 : range;
      const newValue = Math.max(min, Math.min(max, startValue + (delta / 100) * effectiveRange));
      // Snap to step
      const stepped = Math.round(newValue / step) * step;
      onChange(Math.max(min, Math.min(max, stepped)));
    };

    const onUp = () => {
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [value, min, max, range, step, onChange]);

  const onDoubleClick = useCallback(() => {
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  return (
    <div className={`ck-container ${dragging ? 'ck-dragging' : ''}`}
      style={{ width: size + 16, minWidth: size + 16 }}>
      <div className="ck-knob"
        ref={knobRef}
        style={{ width: size, height: size }}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        title={`${label}: ${formatted}${unit && unit !== '%' && unit !== 'ms' && unit !== 's' && unit !== 'Hz' ? unit : ''} (double-click reset)`}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background arc */}
          <path d={bgArc} fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={sw} strokeLinecap="round" />
          {/* Value arc */}
          {valArc && (
            <path d={valArc} fill="none"
              stroke={color}
              strokeWidth={sw}
              strokeLinecap="round"
              style={{
                transition: dragging ? 'none' : 'stroke-dashoffset 0.1s ease',
              }} />
          )}
          {/* Indicator dot */}
          {normalized > 0 && (
            <>
              <line x1={cx} y1={cy}
                x2={cx + Math.cos(valueAngle) * r}
                y2={cy + Math.sin(valueAngle) * r}
                stroke={color} strokeWidth={1.5}
                opacity={0.5}
                style={{ transition: dragging ? 'none' : 'opacity 0.2s' }} />
              <circle cx={cx + Math.cos(valueAngle) * (r - sw * 0.3)}
                cy={cy + Math.sin(valueAngle) * (r - sw * 0.3)}
                r={sw * 0.7} fill={color}
                style={{ transition: dragging ? 'none' : 'all 0.1s ease' }} />
            </>
          )}
          {/* Center dot */}
          <circle cx={cx} cy={cy} r={2} fill="rgba(255,255,255,0.15)" />
        </svg>
      </div>
      <div style={{ textAlign: 'center', marginTop: 2 }}>
        <div className="ck-label">{label}</div>
        <div className="ck-value">{formatted}</div>
      </div>
    </div>
  );
}

// ── SVG arc path helper ───────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function describeArc(
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? '0' : '1';
  return [
    'M', start.x, start.y,
    'A', r, r, 0, largeArcFlag, 0, end.x, end.y,
  ].join(' ');
}

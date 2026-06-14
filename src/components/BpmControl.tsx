import { useRef, useState } from 'react';

const MIN_BPM = 30;
const MAX_BPM = 300;
export const DEFAULT_BPM = 128;

interface BpmControlProps {
  value: number;
  onChange: (bpm: number) => void;
}

function clamp(v: number) {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(v)));
}

export default function BpmControl({ value, onChange }: BpmControlProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nudge = (delta: number) => onChange(clamp(value + delta));

  const startEdit = () => {
    setDraft(String(value));
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const commitEdit = () => {
    const n = parseInt(draft, 10);
    if (!isNaN(n)) onChange(clamp(n));
    setEditing(false);
  };

  const handleDisplayClick = () => {
    if (clickTimer.current) {
      // second click of a double-click — reset instead of edit
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      onChange(DEFAULT_BPM);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        startEdit();
      }, 220);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    nudge(e.deltaY < 0 ? 1 : -1);
  };

  const handleArrowKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      nudge(e.shiftKey ? -5 : -1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      nudge(e.shiftKey ? 5 : 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startEdit();
    }
  };

  return (
    <div className="bpm-control" onWheel={handleWheel}>
      <button
        type="button"
        className="bpm-arrow"
        aria-label="Decrease BPM (Shift: −5)"
        title="−1 BPM  (Shift: −5)"
        onClick={(e) => nudge(e.shiftKey ? -5 : -1)}
      >
        ◄
      </button>

      <div className="bpm-display">
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            className="bpm-input"
            value={draft}
            min={MIN_BPM}
            max={MAX_BPM}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
              if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
            }}
          />
        ) : (
          <span
            className="bpm-value"
            role="spinbutton"
            aria-valuenow={value}
            aria-valuemin={MIN_BPM}
            aria-valuemax={MAX_BPM}
            aria-label={`Tempo: ${value} BPM. Click to edit, double-click to reset, arrow keys or scroll to adjust.`}
            tabIndex={0}
            onClick={handleDisplayClick}
            onKeyDown={handleArrowKey}
          >
            {value}
          </span>
        )}
        <span className="bpm-unit">BPM</span>
      </div>

      <button
        type="button"
        className="bpm-arrow"
        aria-label="Increase BPM (Shift: +5)"
        title="+1 BPM  (Shift: +5)"
        onClick={(e) => nudge(e.shiftKey ? 5 : 1)}
      >
        ►
      </button>
    </div>
  );
}

interface SequencerProps {
  /** The generated (source) pattern from the engine — the authoritative shape. */
  pattern: boolean[];
  /** Manual mute overlay (step-indexed). A muted onset stays visible but dimmed. */
  mutedSteps?: boolean[];
  /** Currently sounding step while playing, or -1 when stopped. */
  currentStep: number;
  /** Toggle the manual mute of a generated onset (only onsets are clickable). */
  onToggleStep?: (step: number) => void;
}

// Coordinates live in the SVG's own units; visible size is driven entirely
// by CSS so a card can shrink the same sequencer to fit a 2x2 grid.
const VB = 320;
const CENTER = VB / 2;
const RADIUS = 125; // < VB/2 so dots never clip the viewBox edge

function coord(index: number, steps: number): { x: number; y: number } {
  const angle = (-90 + (360 / steps) * index) * (Math.PI / 180);
  return {
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
  };
}

export default function Sequencer({
  pattern,
  mutedSteps,
  currentStep,
  onToggleStep,
}: SequencerProps) {
  const steps = pattern.length;
  const onsets = pattern.filter(Boolean).length;

  // The polygon connects the GENERATED onsets (muted ones included): the
  // Toussaint shape always reflects what the Euclidean engine produced.
  const shapePoints = pattern
    .map((on, i) => (on ? coord(i, steps) : null))
    .filter((p): p is { x: number; y: number } => p !== null)
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const localStep = currentStep >= 0 ? currentStep % steps : -1;
  const hand = localStep >= 0 ? coord(localStep, steps) : null;

  return (
    <svg
      className="sequencer"
      viewBox={`0 0 ${VB} ${VB}`}
      role="img"
      aria-label={`Euclidean rhythm: ${onsets} onsets across ${steps} steps`}
    >
      <circle className="guide" cx={CENTER} cy={CENTER} r={RADIUS} />
      {shapePoints && <polygon className="shape" points={shapePoints} />}
      {hand && <line className="hand" x1={CENTER} y1={CENTER} x2={hand.x} y2={hand.y} />}
      {pattern.map((on, i) => {
        const { x, y } = coord(i, steps);
        const muted = on && !!mutedSteps?.[i];
        const classes =
          'step ' +
          (on ? 'onset' : 'rest') +
          (muted ? ' muted' : '') +
          (i === localStep ? ' current' : '') +
          (on && onToggleStep ? ' clickable' : '');
        return (
          <g key={i}>
            <circle
              className={classes}
              cx={x}
              cy={y}
              r={on ? 11 : 5}
              onClick={on && onToggleStep ? () => onToggleStep(i) : undefined}
              role={on && onToggleStep ? 'button' : undefined}
              aria-label={
                on && onToggleStep
                  ? `${muted ? 'Unmute' : 'Mute'} onset at step ${i}`
                  : undefined
              }
            />
            {muted && (
              <g className="mute-cross" pointerEvents="none">
                <line x1={x - 6} y1={y - 6} x2={x + 6} y2={y + 6} />
                <line x1={x - 6} y1={y + 6} x2={x + 6} y2={y - 6} />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

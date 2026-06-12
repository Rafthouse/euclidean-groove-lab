interface SequencerProps {
  /** The generated (source) pattern from the engine — the authoritative shape. */
  pattern: boolean[];
  /**
   * Step-indexed mute mask derived from onset-indexed manualMute via
   * `trackPattern().mutedStepMask`. A muted onset stays visible but dimmed.
   */
  mutedSteps?: boolean[];
  /** Currently sounding step while playing, or -1 when stopped. */
  currentStep: number;
  /**
   * Optional: toggle the mute of the generated onset at `step`. When provided
   * the ring becomes an interactive editing surface — clicking an onset circle
   * mutes/unmutes that musical event (onset-indexed in the engine).
   * Rests are never clickable.
   */
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

/**
 * Euclidean pattern ring — primary editing surface for the mute overlay.
 * Clicking an onset mutes/unmutes that musical EVENT (not the step position):
 * the same event stays muted even after the rotation knob is turned.
 * The polygon always reflects the full unmasked Euclidean shape.
 */
export default function Sequencer({
  pattern,
  mutedSteps,
  currentStep,
  onToggleStep,
}: SequencerProps) {
  const steps = pattern.length;
  const onsets = pattern.filter(Boolean).length;

  // The polygon connects ALL generated onsets (muted ones included): the
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
        const clickable = on && !!onToggleStep;
        const classes =
          'step ' +
          (on ? 'onset' : 'rest') +
          (muted ? ' muted' : '') +
          (i === localStep ? ' current' : '') +
          (clickable ? ' clickable' : '');
        return (
          <g key={i}>
            <circle
              className={classes}
              cx={x}
              cy={y}
              r={on ? 11 : 5}
              onClick={clickable ? () => onToggleStep(i) : undefined}
              role={clickable ? 'button' : undefined}
              aria-label={
                clickable
                  ? `${muted ? 'Unmute' : 'Mute'} onset at step ${i + 1}`
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

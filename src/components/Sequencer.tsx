interface SequencerProps {
  /** The resolved pattern from the engine (single source of truth). */
  pattern: boolean[];
  /** Currently sounding step while playing, or -1 when stopped. */
  currentStep: number;
}

const SIZE = 360;
const CENTER = SIZE / 2;
const RADIUS = 140; // < SIZE/2 so dots never clip the viewBox edge

function coord(index: number, steps: number): { x: number; y: number } {
  const angle = (-90 + (360 / steps) * index) * (Math.PI / 180);
  return {
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
  };
}

export default function Sequencer({ pattern, currentStep }: SequencerProps) {
  const steps = pattern.length;
  const onsets = pattern.filter(Boolean).length;

  // The polygon connecting onsets is the rhythm's "shape" (Toussaint geometry).
  const shapePoints = pattern
    .map((on, i) => (on ? coord(i, steps) : null))
    .filter((p): p is { x: number; y: number } => p !== null)
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const hand = currentStep >= 0 ? coord(currentStep, steps) : null;

  return (
    <svg
      className="sequencer"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      role="img"
      aria-label={`Euclidean rhythm: ${onsets} onsets across ${steps} steps`}
    >
      <circle className="guide" cx={CENTER} cy={CENTER} r={RADIUS} />
      {shapePoints && <polygon className="shape" points={shapePoints} />}
      {hand && <line className="hand" x1={CENTER} y1={CENTER} x2={hand.x} y2={hand.y} />}
      {pattern.map((on, i) => {
        const { x, y } = coord(i, steps);
        const classes =
          'step ' + (on ? 'onset' : 'rest') + (i === currentStep ? ' current' : '');
        return <circle key={i} className={classes} cx={x} cy={y} r={on ? 13 : 6} />;
      })}
    </svg>
  );
}

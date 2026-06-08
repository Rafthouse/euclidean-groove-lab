import { euclid, rotate } from '../engine';

interface SequencerProps {
  steps: number;
  hits: number;
  rotation: number;
}

const radius = 200;
const centerX = radius;
const centerY = radius;

const Sequencer = ({ steps, hits, rotation }: SequencerProps) => {
  // Single source of truth: the pure engine. UI never reimplements the
  // generator. Note euclid takes (hits, steps); rotation is applied on top.
  const sequence = rotate(euclid(hits, steps), rotation);

  return (
    <svg
      width={radius * 2}
      height={radius * 2}
      viewBox={`0 0 ${radius * 2} ${radius * 2}`}
      className="sequencer"
    >
      {sequence.map((step, index) => {
        const angle = (360 / steps) * index - 90;
        const x = centerX + radius * Math.cos((angle * Math.PI) / 180);
        const y = centerY + radius * Math.sin((angle * Math.PI) / 180);

        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={10}
            fill={step ? '#00ff00' : '#555555'}
          />
        );
      })}
    </svg>
  );
};

export default Sequencer;
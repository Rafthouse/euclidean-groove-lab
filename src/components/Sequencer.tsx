interface SequencerProps {
  steps: number;
  hits: number;
  rotation: number;
}

const radius = 200;
const centerX = radius;
const centerY = radius;

const Sequencer = ({ steps, hits, rotation }: SequencerProps) => {
  const sequence = generateEuclidean(steps, hits, rotation);

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

const generateEuclidean = (
  steps: number,
  hits: number,
  rotation: number
): number[] => {
  const pattern = new Array(steps).fill(0);
  let remainder = hits;
  let ptr = 0;

  while (remainder >= 0) {
    const spacing = Math.floor(steps / remainder);

    ptr += spacing;
    ptr %= steps;
    pattern[ptr] = 1;
    remainder -= 1;
    steps -= 1;
  }

  return rotateArray(pattern, rotation);
};

const rotateArray = (array: number[], offset: number): number[] => {
  const len = array.length;
  offset = offset % len;
  return array.slice(offset).concat(array.slice(0, offset));
};

export default Sequencer;
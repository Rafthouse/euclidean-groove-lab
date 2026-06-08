import { useEffect, useMemo, useState } from 'react';
import Sequencer from './components/Sequencer';
import { euclid, rotate, density, syncopation, onsetCount } from './engine';
import { start, stop, setPattern, setBpm, onStep } from './audio';

const isPowerOfTwo = (x: number) => x > 0 && (x & (x - 1)) === 0;

export default function App() {
  const [steps, setSteps] = useState(16);
  const [hits, setHits] = useState(5);
  const [rotation, setRotation] = useState(0);
  const [bpm, setTempo] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  // Keep hits/rotation valid as the grid size changes.
  useEffect(() => {
    setHits((h) => Math.min(h, steps));
    setRotation((r) => ((r % steps) + steps) % steps);
  }, [steps]);

  // Engine is the single source of truth; UI and audio just consume this.
  const pattern = useMemo(
    () => rotate(euclid(hits, steps), rotation),
    [hits, steps, rotation]
  );

  useEffect(() => setPattern(pattern), [pattern]);
  useEffect(() => setBpm(bpm), [bpm]);
  useEffect(() => onStep(setCurrentStep), []);

  const togglePlay = async () => {
    if (playing) {
      stop();
      setPlaying(false);
      setCurrentStep(-1);
    } else {
      await start(pattern, bpm);
      setPlaying(true);
    }
  };

  return (
    <main className="app">
      <header>
        <h1>Groove Lab</h1>
        <p className="tagline">Euclidean rhythms — see the shape, hear the groove.</p>
      </header>

      <Sequencer pattern={pattern} currentStep={currentStep} />

      <button
        className={`play${playing ? ' is-playing' : ''}`}
        onClick={togglePlay}
      >
        {playing ? '■ Stop' : '▶ Play'}
      </button>

      <section className="controls">
        <Control label="Steps" value={steps} min={2} max={32} onChange={setSteps} />
        <Control label="Hits" value={hits} min={0} max={steps} onChange={setHits} />
        <Control
          label="Rotation"
          value={rotation}
          min={0}
          max={Math.max(0, steps - 1)}
          onChange={setRotation}
        />
        <Control label="Tempo" value={bpm} min={40} max={240} suffix=" BPM" onChange={setTempo} />
      </section>

      <section className="metrics" aria-label="Groove metrics — independent axes, not a single score">
        <Axis name="Onsets" value={`${onsetCount(pattern)}/${steps}`} />
        <Axis name="Density" value={`${Math.round(density(pattern) * 100)}%`} />
        <Axis name="Syncopation" value={isPowerOfTwo(steps) ? String(syncopation(pattern)) : '—'} />
      </section>

      <p className="note">
        Audio is a single kick voice for now, and it follows the pattern you see.
        Multi-track voices arrive next.
      </p>
    </main>
  );
}

interface ControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function Control({ label, value, min, max, suffix = '', onChange }: ControlProps) {
  return (
    <label className="control">
      <span className="control-label">
        {label}
        <b>
          {value}
          {suffix}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Axis({ name, value }: { name: string; value: string }) {
  return (
    <div className="axis">
      <span className="axis-value">{value}</span>
      <span className="axis-name">{name}</span>
    </div>
  );
}

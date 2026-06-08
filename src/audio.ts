import * as Tone from 'tone';

// One kick voice for now. Multi-track voices (rim/shaker/bass) arrive later.
const kick = new Tone.MembraneSynth().toDestination();

// The audio layer is a *consumer* of the engine: it never generates rhythm,
// it only plays whatever pattern the app feeds it.
let pattern: boolean[] = [];
let stepCallback: ((step: number) => void) | null = null;

export function setPattern(next: boolean[]): void {
  pattern = next;
}

export function setBpm(bpm: number): void {
  Tone.getTransport().bpm.value = bpm;
}

/** Register a callback fired (visually, via Tone.Draw) on each step. */
export function onStep(callback: (step: number) => void): void {
  stepCallback = callback;
}

export async function start(initialPattern: boolean[], bpm: number): Promise<void> {
  await Tone.start(); // resume AudioContext (must follow a user gesture)
  pattern = initialPattern;

  const transport = Tone.getTransport();
  transport.bpm.value = bpm;

  let step = 0;
  transport.scheduleRepeat((time) => {
    const length = pattern.length;
    if (length === 0) return;
    const index = step % length;
    if (pattern[index]) {
      kick.triggerAttackRelease('C2', '8n', time);
    }
    // Drive the playhead on the animation frame aligned to audio time.
    Tone.getDraw().schedule(() => stepCallback?.(index), time);
    step += 1;
  }, '16n');

  transport.start();
}

export function stop(): void {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  Tone.getDraw().cancel();
}

import * as Tone from 'tone';

const kick = new Tone.MembraneSynth().toDestination();

function start() {
  Tone.start();

  new Tone.Sequence(
    (time, value) => {
      if (value) {
        kick.triggerAttackRelease('C2', '8n', time);
      }
    },
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    '16n'
  ).start(0);

  Tone.Transport.bpm.value = 120;
  Tone.Transport.start();
}

function stop() {
  Tone.Transport.stop();
  Tone.Transport.cancel();
}

export { start, stop };
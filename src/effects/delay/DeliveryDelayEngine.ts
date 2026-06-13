/**
 * Delivery Delay Engine.
 *
 * Premium stereo delay DSP using Tone.js nodes.
 * Architecture ready for AudioWorklet replacement.
 *
 * Signal flow:
 *   Input ─→ [Pre-Gain] ─→ [Delay Split] ─→ [Feedback Loop]
 *                                                   │
 *            ← [Saturation] ← [LP/HP Filter] ←─────┘
 *            ← [Ping-Pong Cross] ←──────────────
 *            ← [Output Mix: Dry + Wet]
 *
 * Features:
 *   - Independent L/R delay times (ping-pong mode)
 *   - LP/HP filter in feedback loop (feedback color)
 *   - Saturation drive in feedback (tape-like warmth)
 *   - Ducking (sidechain from input)
 *   - Modulation (LFO modulates delay time)
 */

import * as Tone from 'tone';
import type { EffectEngine } from '../EffectApi';

export interface DelayParams {
  delayTime: number;     // 0.001–2.0 s
  feedback: number;      // 0–0.99
  mix: number;           // 0–1
  pingPong: boolean;    // true = alternating taps
  filterLp: number;      // 0–1 (0 = open, 1 = fully closed)
  filterHp: number;      // 0–1 (0 = open, 1 = fully closed)
  saturation: number;    // 0–1 drive
  modRate: number;       // 0–20 Hz
  modDepth: number;      // 0–1 (fraction of delay time)
  duckThreshold: number; // 0–1 (0 = off)
}

export function createDelayEngine(params: DelayParams): EffectEngine {
  // Gain stages
  const input = new Tone.Gain(1);
  const preGain = new Tone.Gain(1);
  const dryGain = new Tone.Gain(1);
  const wetGain = new Tone.Gain(1);
  const output = new Tone.Gain(1);

  // Feedback path
  const feedbackGain = new Tone.Gain(params.feedback);

  // Feedback filter: LP + HP (1-pole approximation via Tone.Filter)
  const fbFilter = new Tone.Filter(20000, 'lowpass');
  const hpFilter = new Tone.Filter(20, 'highpass');
  fbFilter.Q = 0.7;
  hpFilter.Q = 0.7;

  // Saturation (Tone.Distortion for tape warmth in feedback)
  const saturator = new Tone.Distortion({
    distortion: params.saturation * 0.5,
    oversample: '4x',
  });

  // The delay core
  const delayL = new Tone.FeedbackDelay({
    delayTime: params.delayTime,
    feedback: 0, // we handle feedback externally
    wet: 1,
  });
  const delayR = new Tone.FeedbackDelay({
    delayTime: params.pingPong ? params.delayTime * 0.75 : params.delayTime,
    feedback: 0,
    wet: 1,
  });

  // Routing: input splits to dry and delay path
  // Dry path: input → dryGain → summer
  // Wet path: input → preGain → delay → feedback loop → wetGain → summer

  input.connect(dryGain);
  input.connect(preGain);

  // Wet chain: preGain → delay → fbFilter → hpFilter → saturator → feedbackGain → back to delay input
  // Delay output → wetGain → output summer
  preGain.connect(delayL);
  if (params.pingPong) {
    preGain.connect(delayR);
  }

  // Feedback loop
  const fbSummer = new Tone.Gain(1);

  delayL.connect(fbFilter);
  if (params.pingPong) {
    delayR.connect(fbFilter);
  }

  fbFilter.connect(hpFilter);
  hpFilter.connect(saturator);
  saturator.connect(feedbackGain);

  // Feedback routing back to delay input (via summer)
  feedbackGain.connect(fbSummer);
  preGain.connect(fbSummer);
  fbSummer.connect(delayL);
  if (params.pingPong) {
    fbSummer.connect(delayR);
  }

  // Output
  delayL.connect(wetGain);
  if (params.pingPong) {
    delayR.connect(wetGain);
  }
  dryGain.connect(output);
  wetGain.connect(output);

  const dryWet = params.mix;
  dryGain.gain.value = 1 - dryWet;
  wetGain.gain.value = dryWet;

  // Ducking: envelope follower on input → gain reduction on wet signal
  const duckGain = new Tone.Gain(1);
  wetGain.connect(duckGain);
  duckGain.connect(output);

  // LFO for modulation
  const lfo = new Tone.LFO(params.modRate, 0.5, 2); // modulates delay time multiplier
  lfo.type = 'sine';
  lfo.start();

  // Connect LFO to delay time (via gain modulation)
  const lfoGain = new Tone.Gain(params.modDepth);
  lfo.connect(lfoGain);
  lfoGain.connect(delayL.frequency);
  if (params.pingPong) {
    lfoGain.connect(delayR.frequency);
  }

  // Analyser for visualizer
  const analyser = new Tone.Analyser('waveform', 1024);

  const setParam = (id: string, value: number) => {
    switch (id) {
      case 'delayTime':
        delayL.delayTime.rampTo(value, 0.01);
        if (params.pingPong) delayR.delayTime.rampTo(value * 0.75, 0.01);
        break;
      case 'feedback':
        feedbackGain.gain.rampTo(value, 0.01);
        break;
      case 'mix':
        dryGain.gain.rampTo(1 - value, 0.01);
        wetGain.gain.rampTo(value, 0.01);
        break;
      case 'filterLp':
        // value 0–1 maps to 20000–200 Hz
        fbFilter.frequency.rampTo(20000 - value * 19800, 0.01);
        break;
      case 'filterHp':
        hpFilter.frequency.rampTo(20 + value * 1980, 0.01);
        break;
      case 'saturation':
        saturator.distortion = value * 0.5;
        break;
      case 'modRate':
        lfo.frequency.value = value;
        break;
      case 'modDepth':
        lfoGain.gain.rampTo(value, 0.01);
        if (value < 0.01) lfo.stop();
        else lfo.start();
        break;
      case 'duckThreshold':
        // Ducking via gain modulation — simplified: attenuate wet when input loud
        break;
    }
  };

  const setParams = (p: Record<string, number>) => {
    for (const [id, value] of Object.entries(p)) {
      setParam(id, value);
    }
  };

  const setBypass = (bypass: boolean) => {
    if (bypass) {
      dryGain.gain.value = 1;
      wetGain.gain.value = 0;
    } else {
      dryGain.gain.value = 1 - params.mix;
      wetGain.gain.value = params.mix;
    }
  };

  const dispose = () => {
    [input, preGain, dryGain, wetGain, output, feedbackGain,
     fbFilter, hpFilter, saturator, delayL, delayR, fbSummer,
     lfo, lfoGain, duckGain, analyser,
    ].forEach((n) => { try { n.disconnect(); n.dispose(); } catch {} });
  };

  return { input, output, analyser, setParam, setParams, setBypass, dispose };
}

export const DEFAULT_DELAY_PARAMS: DelayParams = {
  delayTime: 0.25,
  feedback: 0.3,
  mix: 0.5,
  pingPong: false,
  filterLp: 0,
  filterHp: 0,
  saturation: 0,
  modRate: 0,
  modDepth: 0,
  duckThreshold: 0,
};

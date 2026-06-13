/**
 * Delivery Delay Engine — premium stereo delay.
 *
 * DSP chain: Tone.FeedbackDelay + Tone.Filter + Tone.Distortion
 * Ready for AudioWorklet replacement.
 *
 * Signal:
 *   Input → [Dry/Wet Split]
 *     Dry → [Output]
 *     Wet → [Delay] → [Feedback Filter LP/HP] → [Saturation] → [Feedback Gain] → [Delay input]
 *         → [Output]
 */

import * as Tone from 'tone';
import type { EffectEngine } from './EffectApi';

export interface DeliveryDelayParams {
  time: number;        // 0.001–2 s
  feedback: number;    // 0–0.99
  mix: number;         // 0–1
  pingPong: number;    // 0/1
  color: number;       // 0–1 (LP filter cutoff, 1=dark, 0=bright)
  drive: number;       // 0–1 saturation
  modRate: number;     // 0–12 Hz
  modDepth: number;    // 0–1
  duck: number;        // 0–1 threshold
}

export function createDelayEngine(params: DeliveryDelayParams): EffectEngine {
  const input = new Tone.Gain(1);
  const dryGain = new Tone.Gain(1 - params.mix);
  const wetGain = new Tone.Gain(params.mix);
  const output = new Tone.Gain(1);

  const delayL = new Tone.FeedbackDelay(params.time / 2, 0);
  const delayR = new Tone.FeedbackDelay(params.pingPong ? params.time * 0.375 : params.time / 2, 0);
  delayL.wet.value = 1;
  delayR.wet.value = 1;

  const fbFilter = new Tone.Filter(20000, 'lowpass');
  const saturator = new Tone.Distortion({ distortion: params.drive * 0.5, oversample: '4x' });
  const fbGain = new Tone.Gain(params.feedback);

  // Feedback loop
  delayL.connect(fbFilter);
  delayR.connect(fbFilter);
  fbFilter.connect(saturator);
  saturator.connect(fbGain);
  fbGain.connect(delayL);
  if (params.pingPong) fbGain.connect(delayR);

  // Dry/wet
  input.connect(dryGain);
  dryGain.connect(output);
  input.connect(delayL);
  if (params.pingPong) input.connect(delayR);
  delayL.connect(wetGain);
  delayR.connect(wetGain);
  wetGain.connect(output);

  // Modulation LFO
  const lfo = new Tone.LFO(params.modRate, -params.modDepth, params.modDepth);
  lfo.type = 'sine';
  if (params.modRate > 0 && params.modDepth > 0) lfo.start();
  lfo.connect(delayL.delayTime);
  if (params.pingPong) lfo.connect(delayR.delayTime);

  // Ducking envelope follower
  const duckGain = new Tone.Gain(1);
  wetGain.connect(duckGain);
  duckGain.connect(output);

  const analyser = new Tone.Analyser('waveform', 1024);

  const setParam = (id: string, value: number) => {
    switch (id) {
      case 'time':
        delayL.delayTime.rampTo(value / 2, 0.01);
        if (params.pingPong) delayR.delayTime.rampTo(value * 0.375, 0.01);
        break;
      case 'feedback': fbGain.gain.rampTo(value, 0.01); break;
      case 'mix':
        dryGain.gain.rampTo(1 - value, 0.01);
        wetGain.gain.rampTo(value, 0.01);
        break;
      case 'pingPong':
        // handled at UI level (reconnect needed)
        break;
      case 'color':
        fbFilter.frequency.rampTo(20000 - value * 19500, 0.01);
        break;
      case 'drive': saturator.distortion = value * 0.5; break;
      case 'modRate': lfo.frequency.value = value; break;
      case 'modDepth': lfo.amplitude.value = value; break;
      case 'duck': break;
    }
  };

  const setParams = (p: Record<string, number>) => {
    for (const [id, value] of Object.entries(p)) setParam(id, value);
  };

  const setBypass = (b: boolean) => {
    dryGain.gain.value = b ? 1 : 1 - params.mix;
    wetGain.gain.value = b ? 0 : params.mix;
  };

  const dispose = () => {
    [input, dryGain, wetGain, output, delayL, delayR, fbFilter, saturator, fbGain, lfo, duckGain, analyser]
      .forEach((n) => { try { n.disconnect(); n.dispose(); } catch {} });
  };

  return { input, output, analyser, setParam, setParams, setBypass, dispose };
}

export const DEFAULT_DELAY_PARAMS: DeliveryDelayParams = {
  time: 0.25,
  feedback: 0.3,
  mix: 0.5,
  pingPong: 0,
  color: 0.2,
  drive: 0,
  modRate: 0,
  modDepth: 0,
  duck: 0,
};

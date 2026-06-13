/**
 * Delivery Delay — AudioWorklet Processor.
 *
 * Premium stereo delay with:
 *   - Ping-pong mode (alternating L/R taps)
 *   - Low-pass / high-pass filter in feedback loop
 *   - Saturation (soft-clip) in feedback
 *   - Modulation (LFO on delay time for chorus/flange effects)
 *   - Ducking (sidechain-aware gain reduction on feedback)
 *   - Clean interpolation for smooth time changes
 *
 * This runs on the audio thread — zero JS main-thread latency.
 *
 * Register in main thread before use:
 *   await context.audioWorklet.addModule('DeliveryDelayWorklet.js');
 *   const node = new AudioWorkletNode(context, 'delivery-delay-processor');
 */

const DELAY_MAX = 2.0; // seconds

class DeliveryDelayProcessor extends AudioWorkletProcessor {
  // Delay line buffers (stereo)
  private _bufferL: Float32Array;
  private _bufferR: Float32Array;
  private _writeIndex: number = 0;

  // Parameters
  private _delayTime: number = 0.25;   // seconds
  private _feedback: number = 0.3;     // 0–1
  private _mix: number = 0.5;          // 0–1
  private _pingPong: boolean = false;
  private _filterLp: number = 1;       // 0–1 (1 = fully open)
  private _filterHp: number = 0;       // 0–1 (0 = fully open)
  private _saturation: number = 0;     // 0–1 drive
  private _modRate: number = 0;        // Hz (0 = off)
  private _modDepth: number = 0;       // 0–1 fraction of delay time
  private _duckThreshold: number = 0;  // 0–1 (0 = no ducking)

  // LFO phase
  private _modPhase: number = 0;

  // Filter state (1-pole IIR per channel)
  private _lpZ1L: number = 0;
  private _lpZ1R: number = 0;
  private _hpZ1L: number = 0;
  private _hpZ1R: number = 0;

  // Envelope follower for ducking
  private _envelope: number = 0;

  constructor() {
    super();
    this._bufferL = new Float32Array(sampleRate * DELAY_MAX);
    this._bufferR = new Float32Array(sampleRate * DELAY_MAX);

    this.port.onmessage = (event) => {
      const { id, value } = event.data;
      switch (id) {
        case 'delayTime': this._delayTime = Math.max(0.001, Math.min(DELAY_MAX, value)); break;
        case 'feedback': this._feedback = Math.max(0, Math.min(0.99, value)); break;
        case 'mix': this._mix = Math.max(0, Math.min(1, value)); break;
        case 'pingPong': this._pingPong = value >= 0.5; break;
        case 'filterLp': this._filterLp = Math.max(0, Math.min(1, value)); break;
        case 'filterHp': this._filterHp = Math.max(0, Math.min(1, value)); break;
        case 'saturation': this._saturation = Math.max(0, Math.min(1, value)); break;
        case 'modRate': this._modRate = Math.max(0, Math.min(20, value)); break;
        case 'modDepth': this._modDepth = Math.max(0, Math.min(1, value)); break;
        case 'duckThreshold': this._duckThreshold = Math.max(0, Math.min(1, value)); break;
      }
    };
  }

  static get parameterDescriptors() {
    return [];
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) return true;

    const inL = input[0];
    const inR = input[1] || input[0];
    const outL = output[0];
    const outR = output[1] || output[0];

    const len = Math.min(inL.length, outL.length);
    const sampleRate = sampleRate; // provided by AudioWorkletGlobalScope

    // LFO step per sample
    const modStep = this._modRate > 0
      ? (this._modRate * Math.PI * 2) / sampleRate
      : 0;

    for (let i = 0; i < len; i++) {
      // ── Modulate delay time ────────────────────────────────────────
      this._modPhase += modStep;
      if (this._modPhase > Math.PI * 2) this._modPhase -= Math.PI * 2;

      let modDelay = this._delayTime;
      if (this._modDepth > 0 && this._modRate > 0) {
        const lfo = Math.sin(this._modPhase) * this._modDepth;
        modDelay = this._delayTime * (1 + lfo * 0.5);
        modDelay = Math.max(0.001, Math.min(DELAY_MAX, modDelay));
      }

      // ── Read from delay line ───────────────────────────────────────
      const readSamples = modDelay * sampleRate;
      const readIndex = (this._writeIndex - readSamples + this._bufferL.length) % this._bufferL.length;

      // Linear interpolation
      const idxFloor = Math.floor(readIndex);
      const frac = readIndex - idxFloor;
      const idxNext = (idxFloor + 1) % this._bufferL.length;

      let delaySampleL = this._bufferL[idxFloor] * (1 - frac) + this._bufferL[idxNext] * frac;
      let delaySampleR = this._pingPong
        ? -this._bufferR[idxFloor] * (1 - frac) + -this._bufferR[idxNext] * frac
        : this._bufferR[idxFloor] * (1 - frac) + this._bufferR[idxNext] * frac;

      // ── Feedback filter (1-pole LPF + HPF) ─────────────────────────
      // LPF
      const lpCoeff = 1 - Math.pow(0.5, 1 / (sampleRate * 0.001 * (1 + this._filterLp * 99)));
      this._lpZ1L += lpCoeff * (delaySampleL - this._lpZ1L);
      this._lpZ1R += lpCoeff * (delaySampleR - this._lpZ1R);
      delaySampleL = this._lpZ1L;
      delaySampleR = this._lpZ1R;

      // HPF
      const hpCoeff = 1 - Math.pow(0.5, 1 / (sampleRate * 0.001 * (1 + this._filterHp * 199)));
      this._hpZ1L += hpCoeff * (delaySampleL - this._hpZ1L);
      this._hpZ1R += hpCoeff * (delaySampleR - this._hpZ1R);
      delaySampleL = delaySampleL - this._hpZ1L;
      delaySampleR = delaySampleR - this._hpZ1R;

      // ── Saturation ─────────────────────────────────────────────────
      if (this._saturation > 0.01) {
        const drive = 1 + this._saturation * 9;
        delaySampleL = softClip(delaySampleL * drive) / drive * (1 + this._saturation * 0.5);
        delaySampleR = softClip(delaySampleR * drive) / drive * (1 + this._saturation * 0.5);
      }

      // ── Ducking ────────────────────────────────────────────────────
      if (this._duckThreshold > 0.01) {
        const inputLevel = Math.abs(inL[i]) + Math.abs(inR[i]);
        this._envelope += 0.3 * (inputLevel - this._envelope);
        if (this._envelope > this._duckThreshold) {
          const gainReduction = 1 - (this._envelope - this._duckThreshold) / (1 - this._duckThreshold) * 0.8;
          delaySampleL *= Math.max(0.2, gainReduction);
          delaySampleR *= Math.max(0.2, gainReduction);
        }
      }

      // ── Write to delay line ────────────────────────────────────────
      const feedbackGain = this._feedback;
      this._bufferL[this._writeIndex] = inL[i] + delaySampleL * feedbackGain;
      this._bufferR[this._writeIndex] = this._pingPong
        ? inR[i] - delaySampleR * feedbackGain
        : inR[i] + delaySampleR * feedbackGain;

      // ── Output ─────────────────────────────────────────────────────
      const dryGain = 1 - this._mix;
      const wetGain = this._mix;
      outL[i] = inL[i] * dryGain + delaySampleL * wetGain;
      outR[i] = inR[i] * dryGain + delaySampleR * wetGain;

      // Advance write index
      this._writeIndex = (this._writeIndex + 1) % this._bufferL.length;
    }

    return true;
  }
}

function softClip(x: number): number {
  // tanh approximation
  const x2 = x * x;
  return x * (27 + x2) / (27 + 9 * x2);
}

registerProcessor('delivery-delay-processor', DeliveryDelayProcessor);

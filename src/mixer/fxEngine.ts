/**
 * Audio FX Engine.
 *
 * Maps the declarative FxSlot[] model into live Tone.js effect nodes,
 * wired in series between the channel gain node and the channel panner.
 *
 * Key design:
 *   - Effects instantiated ONLY when the slot is added (lazy allocation).
 *   - Disabled effects → bypass via Tone.Gain (zero DSP cost).
 *   - Empty chain → no DSP allocation at all.
 *
 * Sidechain preparation:
 *   - Compressor slot has sidechainSource field (string | null).
 *   - When set, audio.ts will connect the source channel to compressor's
 *     sidechain input via a Gain envelope follower.
 *   - Full UI for sidechain routing is Phase 3.
 */
import * as Tone from 'tone';
import type { FxSlot } from './fxTypes';

/**
 * Create a Tone.js effect node from a slot definition.
 * Returns the Tone node (or a Gain bypass when disabled).
 */
function createFxNode(slot: FxSlot): Tone.ToneAudioNode {
  const { type, enabled } = slot;

  // When disabled, return a pass-through Gain (zero DSP cost).
  if (!enabled) {
    return new Tone.Gain(1);
  }

  switch (type) {
    case 'eq': {
      const p = slot.params as any;
      return new Tone.EQ3({
        low: p.low, mid: p.mid, high: p.high,
        lowFrequency: p.lowFreq, highFrequency: p.highFreq,
      });
    }

    case 'compressor': {
      const p = slot.params as any;
      return new Tone.Compressor({
        threshold: p.threshold, ratio: p.ratio,
        attack: p.attack, release: p.release,
      });
    }

    case 'delay': {
      const p = slot.params as any;
      return new Tone.FeedbackDelay({
        delayTime: p.time, feedback: p.feedback, wet: p.mix,
      });
    }

    case 'reverb': {
      const p = slot.params as any;
      return new Tone.Reverb({
        decay: p.decay, preDelay: p.preDelay, wet: p.mix,
      });
    }

    case 'chorus': {
      const p = slot.params as any;
      return new Tone.Chorus({
        frequency: p.frequency, delayTime: p.delayTime,
        depth: p.depth, wet: p.mix,
      });
    }

    case 'distortion': {
      const p = slot.params as any;
      return new Tone.Distortion({
        distortion: p.distortion, oversample: p.oversample,
      });
    }

    case 'filter': {
      const p = slot.params as any;
      return new Tone.Filter({
        frequency: p.frequency, type: p.type,
        rolloff: p.rolloff, Q: p.Q, gain: p.gain,
      });
    }

    case 'limiter': {
      const p = slot.params as any;
      return new Tone.Limiter({ threshold: p.threshold });
    }

    case 'stereoWidth':
    case 'gate':
      return new Tone.Gain(1);

    default:
      return new Tone.Gain(1);
  }
}

/**
 * Build a live Tone.js effect chain from an FxSlot[] definition.
 * Chains are serial: input → fx1 → fx2 → ... → output.
 *
 * Returns an object with:
 *   - `input`: the first node (connect source here)
 *   - `output`: the last node (connect to panner here)
 *   - `dispose()`: tear down the entire chain
 */
export function buildFxChain(slots: FxSlot[]): {
  input: Tone.ToneAudioNode;
  output: Tone.ToneAudioNode;
  dispose: () => void;
} {
  if (slots.length === 0) {
    const bypass = new Tone.Gain(1);
    return {
      input: bypass,
      output: bypass,
      dispose: () => {
        bypass.disconnect();
        bypass.dispose();
      },
    };
  }

  const nodes: Tone.ToneAudioNode[] = slots.map(createFxNode);

  // Connect in series: input → fx1 → fx2 → ... → output
  for (let i = 0; i < nodes.length - 1; i++) {
    nodes[i].connect(nodes[i + 1]);
  }

  return {
    input: nodes[0],
    output: nodes[nodes.length - 1],
    dispose: () => {
      for (const node of nodes) {
        try { node.disconnect(); node.dispose(); } catch { /* safe */ }
      }
    },
  };
}

/**
 * Update an existing effect slot's live parameters without rebuilt chain.
 */
export function updateFxParams(
  node: Tone.ToneAudioNode,
  slot: FxSlot,
): void {
  if (!slot.enabled) return;

  switch (slot.type) {
    case 'compressor':
      if (node instanceof Tone.Compressor) {
        const p = slot.params as any;
        node.set({ threshold: p.threshold, ratio: p.ratio, attack: p.attack, release: p.release });
      }
      break;
    case 'filter':
      if (node instanceof Tone.Filter) {
        const p = slot.params as any;
        node.set({ frequency: p.frequency, type: p.type, rolloff: p.rolloff, Q: p.Q, gain: p.gain });
      }
      break;
    default:
      break;
  }
}

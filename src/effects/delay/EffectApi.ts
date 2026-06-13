/**
 * Spielzeug Effect API — unified interface for all effects.
 *
 * Every premium effect module must:
 *   1. Export `{EffectName}Params` interface
 *   2. Export `create{EffectName}Engine(params)` → EffectEngine
 *   3. Export `DEFAULT_{EFFECT}_PARAMS`
 *   4. Export a React component for the UI window
 */

import type { Tone } from 'tone';

export interface EffectEngine {
  input: Tone.ToneAudioNode;
  output: Tone.ToneAudioNode;
  analyser?: Tone.Analyser;
  setParam: (id: string, value: number) => void;
  setParams: (params: Record<string, number>) => void;
  setBypass: (bypass: boolean) => void;
  dispose: () => void;
}

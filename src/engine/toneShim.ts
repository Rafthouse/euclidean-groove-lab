/**
 * Re-export Tone.js so the oscilloscope engine can access it without
 * importing 'tone' directly (which may cause build order issues in some
 * environments). Keeps the scope engine independent of audio.ts.
 */
import * as Tone from 'tone';
export { Tone };

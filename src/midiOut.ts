/**
 * Web MIDI API wrapper.
 *
 * Provides MIDI OUT connectivity so the sequencer can drive external
 * synthesizers (Ableton, Bitwig, Logic via virtual port, hardware drum
 * machines, etc.). Pure browser API — no dependencies.
 *
 * Architecture:
 *   - init()           → request MIDI access, populate port list
 *   - selectPort(id)   → choose which output to use
 *   - sendNoteOn/Off() → schedule MIDI messages (time is optional Web MIDI
 *                         timestamp; if omitted the system sends ASAP)
 *   - close()          → release resources
 *
 * The audio scheduler in audio.ts calls these functions from its
 * Tone.Transport callback, using Tone's AudioContext.currentTime as the
 * scheduling timestamp so MIDI and audio stay in lockstep.
 */

export interface MidiOutputPort {
  id: string;
  name: string;
  manufacturer: string;
}

type PortChangeCallback = (ports: MidiOutputPort[]) => void;

let midiAccess: MIDIAccess | null = null;
let selectedOutput: MIDIOutput | null = null;
let portListeners: PortChangeCallback[] = [];

/**
 * Request MIDI access and enumerate available output ports.
 * Returns the list of outputs, or an empty array if Web MIDI is unavailable.
 */
export async function init(): Promise<MidiOutputPort[]> {
  if (!navigator.requestMIDIAccess) {
    console.warn('Web MIDI API is not available in this browser.');
    return [];
  }

  try {
    midiAccess = await navigator.requestMIDIAccess();

    // Listen for port changes (device plug/unplug)
    midiAccess.onstatechange = () => {
      if (!midiAccess) return;
      const ports = enumeratePorts();
      for (const cb of portListeners) cb(ports);
    };

    return enumeratePorts();
  } catch (err) {
    console.warn('MIDI access denied or unavailable:', err);
    return [];
  }
}

function enumeratePorts(): MidiOutputPort[] {
  if (!midiAccess) return [];
  const ports: MidiOutputPort[] = [];
  for (const output of midiAccess.outputs.values()) {
    ports.push({
      id: output.id,
      name: output.name ?? 'Unknown',
      manufacturer: output.manufacturer ?? '',
    });
  }
  return ports;
}

/** Subscribe to port list changes. Returns unsubscribe function. */
export function onPortsChange(cb: PortChangeCallback): () => void {
  portListeners.push(cb);
  return () => {
    portListeners = portListeners.filter((l) => l !== cb);
  };
}

/**
 * @returns currently available ports.
 */
export function getPorts(): MidiOutputPort[] {
  return enumeratePorts();
}

/**
 * Select an output port by id. Pass `null` to disconnect.
 * @returns true if the port was found and selected.
 */
export function selectPort(id: string | null): boolean {
  if (!midiAccess || !id) {
    selectedOutput = null;
    return true;
  }
  const output = midiAccess.outputs.get(id);
  if (!output) return false;
  selectedOutput = output;
  return true;
}

/** @returns the currently selected port, or null. */
export function getSelectedPort(): MidiOutputPort | null {
  if (!selectedOutput) return null;
  return {
    id: selectedOutput.id,
    name: selectedOutput.name ?? 'Unknown',
    manufacturer: selectedOutput.manufacturer ?? '',
  };
}

/**
 * Send a Note On message. `time` is optional — if omitted the message fires
 * immediately. For scheduled playback use `Tone.context.currentTime + offset`.
 * The `channel` is 0–15 (0 = MIDI ch 1, 9 = MIDI ch 10 = percussion).
 */
export function sendNoteOn(
  note: number,
  velocity: number,
  channel: number,
  time?: number,
): void {
  if (!selectedOutput) return;
  const status = 0x90 | (channel & 0x0f);
  const vel = Math.max(1, Math.min(127, Math.round(velocity)));
  const data = [status, note & 0x7f, vel];
  if (time !== undefined) {
    selectedOutput.send(data, Math.max(0, time * 1000)); // seconds → ms
  } else {
    selectedOutput.send(data);
  }
}

/**
 * Send a Note Off message.
 */
export function sendNoteOff(
  note: number,
  channel: number,
  time?: number,
): void {
  if (!selectedOutput) return;
  const status = 0x80 | (channel & 0x0f);
  const data = [status, note & 0x7f, 0];
  if (time !== undefined) {
    selectedOutput.send(data, Math.max(0, time * 1000));
  } else {
    selectedOutput.send(data);
  }
}

/**
 * Release the MIDI access handle and disconnect.
 */
export function close(): void {
  selectedOutput = null;
  midiAccess = null;
  portListeners = [];
}

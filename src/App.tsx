import { useCallback, useEffect, useRef, useState } from 'react';
import TrackCard from './components/TrackCard';
import DrumKitSelect from './components/DrumKitSelect';
import Knob from './components/Knob';
import PresetBrowser from './components/PresetBrowser';
import { defaultTracks, renderMidi, serializeMidi, renderMidiStems, computePhaseOffsetForChange, switchTrackPattern } from './engine';
import type { Track, PlaybackMode, PlaybackSpeed } from './engine';
import type { GrooveSnapshot, ThemeId } from './engine/preset';
import { start, stop, setTracks, setBpm, setSwing, onStep, switchDrumKit,
  onKitLoading, resetClock, setMidiOut } from './audio';
import { downloadBytes } from './download';
import type { DrumKitId } from './drumKits';
import { init as initMidi, onPortsChange, selectPort } from './midiOut';
import type { MidiOutputPort } from './midiOut';

/** How many 4/4 bars the MIDI export renders. */
const EXPORT_BARS = 4;

type AppThemeId = 'dark' | 'paper' | 'elements' | 'military' | 'old-school' | 'cherry' | 'nostradamus' | 'big-boss' | 'university' | 'neon-void' | 'dark-side' | 'bauhaus' | 'smoke-dub' | 'nautilus' | 'satisfaction' | 'revelation' | 'high-contrast' | 'candyflip' | 'barbie' | 'alchemy' | 'beekeeper';
const THEME_KEY = 'groove-theme';
const FX_KEY = 'groove-elements-fx';
const RESTART_KEY = 'groove-restart-on-mode-change';

function initialTheme(): AppThemeId {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'paper' || t === 'elements' || t === 'military' || t === 'old-school' || t === 'cherry' || t === 'nostradamus' || t === 'big-boss' || t === 'university' || t === 'neon-void' || t === 'dark-side' || t === 'bauhaus' || t === 'smoke-dub' || t === 'nautilus' || t === 'satisfaction' || t === 'revelation' || t === 'high-contrast' || t === 'candyflip' || t === 'barbie' || t === 'alchemy' || t === 'beekeeper' ? t : 'elements';
  } catch {
    return 'elements';
  }
}

function initialFx(): boolean {
  try {
    const v = localStorage.getItem(FX_KEY);
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}

function initialRestartOnModeChange(): boolean {
  try {
    const v = localStorage.getItem(RESTART_KEY);
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}

export default function App() {
  const [tracks, setTracksState] = useState<Track[]>(() => defaultTracks());
  const [bpm, setTempo] = useState(120);
  const [swing, setSwingState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<Record<string, number>>({});
  // The global clock `g` is consumed only by the change handler (to compute
  // phaseOffset). Keep it in a ref so it doesn't trigger re-renders every 32n.
  const gRef = useRef(-1);
  const [kitId, setKitId] = useState<DrumKitId>('cr78');
  const [kitLoading, setKitLoading] = useState(false);
  const [theme, setTheme] = useState<AppThemeId>(initialTheme);
  const [elementFx, setElementFx] = useState<boolean>(initialFx);
  const [restartOnModeChange, setRestartOnModeChange] = useState<boolean>(initialRestartOnModeChange);
  // Read in the (synchronous) updateTrack closure without re-renders.
  const restartOnModeChangeRef = useRef(restartOnModeChange);
  restartOnModeChangeRef.current = restartOnModeChange;

  // PresetBrowser state
  const [presetOpen, setPresetOpen] = useState(false);

  const [midiPorts, setMidiPorts] = useState<MidiOutputPort[]>([]);
  const [midiSelected, setMidiSelected] = useState<string | null>(null);
  const [midiEnabled, setMidiEnabled] = useState(false);

  // Build a GrooveSnapshot from the current app state.
  const currentGroove: GrooveSnapshot = {
    bpm,
    swing,
    tracks,
    theme,
  };

  // Initialise Web MIDI on mount
  useEffect(() => {
    initMidi().then((ports) => {
      setMidiPorts(ports);
      if (ports.length > 0) {
        selectPort(ports[0].id);
        setMidiSelected(ports[0].id);
      }
    });
    const unsub = onPortsChange((ports) => setMidiPorts(ports));
    return () => { unsub(); setMidiOut(false); };
  }, []);

  const handleMidiToggle = useCallback(() => {
    setMidiEnabled((prev) => {
      const next = !prev;
      setMidiOut(next);
      return next;
    });
  }, []);

  const handleMidiPortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    selectPort(id);
    setMidiSelected(id);
  }, []);

  // Engine -> audio sync.
  useEffect(() => setTracks(tracks), [tracks]);
  useEffect(() => setBpm(bpm), [bpm]);
  useEffect(() => setSwing(swing / 100), [swing]);

  // Adapt the playhead flash duration to BPM. On fast tempos with a fast
  // voice (e.g. 240 BPM × 2× × Hat 16/16 → `.current` switches every ~31 ms)
  // a fixed 180 ms flash only plays ~17% before the class moves on, painting
  // the whole ring as a low-level shimmer. Scaling the flash to the 32n tick
  // interval keeps each entry visually discrete.
  useEffect(() => {
    const tickMs = 60000 / (bpm * 8); // master subdivision = 32n
    const ms = Math.max(80, Math.min(180, Math.round(tickMs * 2.5)));
    document.documentElement.style.setProperty('--flash-duration', `${ms}ms`);
  }, [bpm]);
  useEffect(() => onStep((g, perTrack) => {
    gRef.current = g;        // single canonical clock for change-time math
    setCurrentSteps((prev) => ({
      ...prev,
      ...perTrack,
    })); // playhead state for each track card
  }), []);
  useEffect(() => onKitLoading(setKitLoading), []);

  // Theme: reflect on <html data-theme> (CSS variables do the rest) + persist.
  // Theme is visual layer only — never modifies track state.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore persistence failures
    }
  }, [theme]);

  // Element FX: reflect on <html data-fx> + persist.
  useEffect(() => {
    document.documentElement.dataset.fx = elementFx ? 'on' : 'off';
    try {
      localStorage.setItem(FX_KEY, elementFx ? 'true' : 'false');
    } catch {
      // ignore persistence failures
    }
  }, [elementFx]);

  // Persist the restart-on-mode-change preference.
  useEffect(() => {
    try {
      localStorage.setItem(RESTART_KEY, restartOnModeChange ? 'true' : 'false');
    } catch {
      // ignore persistence failures
    }
  }, [restartOnModeChange]);

  // Reset all tracks to a deterministic cycle origin.
  // - Zeros the SAME global clock the scheduler reads (no second timing source).
  // - Clears every track's phaseOffset (no preserved-position carryover).
  // - Clears the playhead state so the UI snaps to cycle start immediately.
  // Transport keeps running: no stop/start glitch, no sample tail cut.
  const resetAllTracks = useCallback(() => {
    resetClock();
    setTracksState((prev) => prev.map((t) => ({ ...t, phaseOffset: 0 })));
    setCurrentSteps({});
    gRef.current = 0;
  }, []);

  // Pattern reset: restore every track's generator state (steps/hits/rotation/
  // mask/velocity/pitch) to the application's factory defaults, while preserving
  // audio routing (volume, ghost, mute/solo, playback mode/speed).
  const resetPatterns = useCallback(() => {
    const defaults = defaultTracks();
    setTracksState((prev) =>
      prev.map((t) => {
        const def = defaults.find((d) => d.id === t.id) ?? t;
        return {
          ...t,
          steps: def.steps,
          hits: def.hits,
          rotation: def.rotation,
          manualMute: undefined,
          velocity: undefined,
          velocityEnabled: undefined,
          pitches: undefined,
          pitchEnabled: undefined,
          ghost: undefined,
          ducking: undefined,
          patterns: undefined,
          activePattern: undefined,
          phaseOffset: 0,
        };
      })
    );
  }, []);

  // Track patch + clamping + (optional) phase preservation.
  //
  // Mode change behaviour depends on the `restartOnModeChange` preference:
  //  - ON  (default, musician-friendly): trigger resetAllTracks(), then apply
  //    the new mode with phaseOffset = 0. Every track snaps to its own cycle
  //    origin so the new mode is heard from a predictable boundary.
  //  - OFF (power-user): preserve the current localStep across the change via
  //    computePhaseOffsetForChange — the old behaviour, no audible jump.
  //
  // Speed change is ALWAYS smooth — it never auto-resets. We still preserve
  // phase across speed changes (so 1× → 2× doesn't teleport), but the cycle
  // origin stays where it was.
  // Steps change also uses phase preservation (preserves position within the
  // pattern when N grows/shrinks).
  const updateTrack = useCallback((id: string, patch: Partial<Track>) => {
    const isModeChange = patch.playbackMode !== undefined;
    const doRestart = isModeChange && restartOnModeChangeRef.current;

    if (doRestart) {
      // Reset clock and offsets BEFORE applying the patch so the new mode
      // starts from origin. Single-clock invariant intact: we only zero the
      // counter and phaseOffsets — no new timing source.
      resetClock();
      gRef.current = 0;
      setCurrentSteps({});
    }

    setTracksState((prev) =>
      prev.map((t) => {
        // Reset all OTHER tracks' phaseOffset too when a restart fires — the
        // whole rig must snap to a known phase, not just the changed track.
        if (t.id !== id) {
          return doRestart && (t.phaseOffset ?? 0) !== 0
            ? { ...t, phaseOffset: 0 }
            : t;
        }

        const merged = { ...t, ...patch };
        merged.hits = Math.min(merged.hits, merged.steps);
        merged.rotation = merged.steps > 0
          ? ((merged.rotation % merged.steps) + merged.steps) % merged.steps
          : 0;
        // manualMute is ONSET-indexed (length === hits). Resize whenever hits
        // changes so the mask stays aligned with the onset count.
        if (merged.manualMute && merged.manualMute.length !== merged.hits) {
          const resized = new Array<boolean>(merged.hits).fill(false);
          const n = Math.min(merged.hits, merged.manualMute.length);
          for (let i = 0; i < n; i++) resized[i] = merged.manualMute[i];
          merged.manualMute = resized.some(Boolean) ? resized : undefined;
        }

        if (doRestart) {
          // Clean cycle origin — no preserved offset.
          merged.phaseOffset = 0;
        } else {
          // Preserve musical position across speed/steps changes (and across
          // mode change too when the user opted out of restart).
          const oldMode: PlaybackMode = t.playbackMode ?? 'forward';
          const oldSpeed: PlaybackSpeed = t.playbackSpeed ?? 1;
          const newMode: PlaybackMode = merged.playbackMode ?? 'forward';
          const newSpeed: PlaybackSpeed = merged.playbackSpeed ?? 1;
          const resolverChanged =
            oldMode !== newMode || oldSpeed !== newSpeed || t.steps !== merged.steps;
          if (resolverChanged && gRef.current >= 0 && t.steps > 0 && merged.steps > 0) {
            merged.phaseOffset = computePhaseOffsetForChange(
              gRef.current,
              oldMode, oldSpeed, t.phaseOffset ?? 0, t.steps,
              newMode, newSpeed, merged.steps,
            );
          }
        }
        return merged;
      })
    );
  }, []);

  // Pattern-bank switch. The heavy lifting (snapshot current slot, load target,
  // clamp, preserve phase across a steps change) is the pure `switchTrackPattern`
  // in the engine — App only routes it through state. Single-clock invariant is
  // untouched: no timing source is created, only `phaseOffset` is recomputed.
  const switchPattern = useCallback((id: string, slot: number) => {
    setTracksState((prev) =>
      prev.map((t) => (t.id === id ? switchTrackPattern(t, slot, gRef.current) : t))
    );
  }, []);

  const toggleMute = useCallback((id: string) => {
    setTracksState((prev) =>
      prev.map((t) => (t.id === id ? { ...t, mute: !t.mute } : t))
    );
  }, []);

  const toggleSolo = useCallback((id: string) => {
    setTracksState((prev) =>
      prev.map((t) => (t.id === id ? { ...t, solo: !t.solo } : t))
    );
  }, []);

  const togglePlay = async () => {
    if (playing) {
      stop();
      setPlaying(false);
      setCurrentSteps({});
    } else {
      await start(tracks, bpm);
      setPlaying(true);
    }
  };

  const handleKitChange = useCallback(async (id: DrumKitId) => {
    await switchDrumKit(id);
    setKitId(id);
  }, []);

  // Export the current groove as a Standard MIDI File (Format 1). Pure engine
  // produces the bytes; downloadBytes is the only DOM/Blob touch.
  const handleExportMidi = () => {
    const bytes = serializeMidi(renderMidi(tracks, EXPORT_BARS, bpm));
    downloadBytes(bytes, 'groove.mid', 'audio/midi');
  };

  // PresetBrowser: load a groove snapshot.
  const handleLoadPreset = useCallback((groove: GrooveSnapshot) => {
    setTempo(groove.bpm);
    setSwingState(groove.swing);
    setTracksState(groove.tracks);
    document.documentElement.dataset.theme = groove.theme;
    try {
      localStorage.setItem(THEME_KEY, groove.theme);
    } catch { /* ignore */ }
    setTheme(groove.theme);
  }, []);

  const handleExportStems = () => {
    const stems = renderMidiStems(tracks, EXPORT_BARS, bpm);
    for (const stem of stems) {
      const bytes = serializeMidi(stem.data);
      const safeName = stem.name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
      downloadBytes(bytes, `${safeName}.mid`, 'audio/midi');
    }
  };

  return (
    <main className="app">
      <header>
        <h1>Euclidean Groove Spielzeug</h1>
        <p className="tagline">
          Four tracks. Each rhythm is a shape. Watch them interlock.
        </p>
      </header>

      <section className="tracks" aria-label="Track grid">
        {tracks.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            currentStep={currentSteps[track.id] ?? -1}
            onChange={(patch) => updateTrack(track.id, patch)}
            onSwitchPattern={(slot) => switchPattern(track.id, slot)}
            onToggleMute={() => toggleMute(track.id)}
            onToggleSolo={() => toggleSolo(track.id)}
          />
        ))}
      </section>

      <section className="transport" aria-label="Transport">
        <button
          className={`play${playing ? ' is-playing' : ''}`}
          onClick={togglePlay}
        >
          {playing ? '■ Stop' : '▶ Play'}
        </button>
        <button
          type="button"
          className="reset"
          onClick={resetAllTracks}
          title="Reset all tracks to cycle origin (clock stays running)"
        >
          ↺ Reset
        </button>
        <button
          type="button"
          className="reset-pattern"
          onClick={resetPatterns}
          title="Restore all tracks to factory default patterns (steps, hits, rotation, velocity, pitch)"
        >
          ⟳ Clear
        </button>
        <div className="transport-knobs">
          <Knob
            label="Tempo"
            value={bpm}
            min={30}
            max={300}
            step={1}
            sensitivity={100}
            resetValue={120}
            format={(v) => `${v} BPM`}
            onChange={setTempo}
          />
          <Knob
            label="Swing"
            value={swing}
            min={0}
            max={100}
            step={1}
            sensitivity={100}
            resetValue={0}
            format={(v) => `${v}%`}
            onChange={setSwingState}
          />
        </div>
        <DrumKitSelect value={kitId} loading={kitLoading} onChange={handleKitChange} />
        <button
          type="button"
          className="presets-button"
          onClick={() => setPresetOpen(true)}
        >
          Presets
        </button>
        <PresetBrowser
          open={presetOpen}
          onClose={() => setPresetOpen(false)}
          onLoadPreset={handleLoadPreset}
          currentGroove={currentGroove}
          developerMode={false}
        />
        {midiPorts.length > 0 && (
          <label className="midi-out">
            MIDI
            <select value={midiSelected ?? ''} onChange={handleMidiPortChange}>
              {midiPorts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={'toggle' + (midiEnabled ? ' is-on' : '')}
              onClick={handleMidiToggle}
              aria-pressed={midiEnabled}
              title="Send MIDI notes to the selected port in real time"
            >
              {midiEnabled ? 'ON' : 'OFF'}
            </button>
          </label>
        )}
        <button
          type="button"
          className="export"
          onClick={handleExportMidi}
          title={`Export ${EXPORT_BARS} bars as a Standard MIDI File`}
        >
          ⤓ MIDI
        </button>
        <button
          type="button"
          className="export"
          onClick={handleExportStems}
          title={`Export per-track MIDI stems (Kick, Snare, Ghost, Hat, Bass)`}
        >
          ⤓ Stems
        </button>
        <label className="theme-select">
          Theme
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as AppThemeId)}
            aria-label="Visual theme"
          >
            <option value="dark">Nocturne</option>
            <option value="paper">Vintage Paper</option>
            <option value="elements">Elements</option>
            <option value="military">Tactical</option>
            <option value="old-school">Old-school</option>
            <option value="cherry">Cherry</option>
            <option value="nostradamus">Nostradamus</option>
            <option value="big-boss">Big Boss</option>
            <option value="university">University</option>
            <option value="neon-void">Neon Void</option>
            <option value="dark-side">Dark Side</option>
            <option value="bauhaus">Bauhaus</option>
            <option value="smoke-dub">Smoke Dub</option>
            <option value="nautilus">Nautilus</option>
            <option value="satisfaction">Satisfaction</option>
            <option value="revelation">Ashes</option>
            <option value="high-contrast">High Contrast</option>
            <option value="candyflip">Candyflip</option>
            <option value="barbie">Barbie</option>
            <option value="alchemy">Alchemy</option>
            <option value="beekeeper">Beekeeper</option>
          </select>
        </label>
        {theme === 'elements' && (
          <label className="preference fx-toggle">
            <input
              type="checkbox"
              checked={elementFx}
              onChange={(e) => setElementFx(e.target.checked)}
            />
            <span>Element FX</span>
          </label>
        )}
        <label className="preference">
          <input
            type="checkbox"
            checked={restartOnModeChange}
            onChange={(e) => setRestartOnModeChange(e.target.checked)}
          />
          <span>Restart cycle on mode change</span>
        </label>
      </section>

      <p className="note">
        Sample-based drums (CR-78, Kit-8, KPR-77) with a sawtooth pick-bass
        synth. Swing shuffles the off-beat 8ths. Switch kits live — Transport
        keeps running. Export {EXPORT_BARS} bars as MIDI (Format 1) for your DAW.
      </p>
    </main>
  );
}

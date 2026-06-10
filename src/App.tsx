import { useCallback, useEffect, useRef, useState } from 'react';
import TrackCard from './components/TrackCard';
import DrumKitSelect from './components/DrumKitSelect';
import { defaultTracks, renderMidi, serializeMidi, computePhaseOffsetForChange } from './engine';
import type { Track, PlaybackMode, PlaybackSpeed } from './engine';
import { start, stop, setTracks, setBpm, setSwing, onStep, switchDrumKit,
  onKitLoading } from './audio';
import { downloadBytes } from './download';
import type { DrumKitId } from './drumKits';

/** How many 4/4 bars the MIDI export renders. */
const EXPORT_BARS = 4;

type ThemeId = 'dark' | 'paper';
const THEME_KEY = 'groove-theme';

function initialTheme(): ThemeId {
  try {
    return localStorage.getItem(THEME_KEY) === 'paper' ? 'paper' : 'dark';
  } catch {
    return 'dark';
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
  const [theme, setTheme] = useState<ThemeId>(initialTheme);

  // Engine -> audio sync.
  useEffect(() => setTracks(tracks), [tracks]);
  useEffect(() => setBpm(bpm), [bpm]);
  useEffect(() => setSwing(swing / 100), [swing]);
  useEffect(() => onStep((g, perTrack) => {
    gRef.current = g;        // single canonical clock for change-time math
    setCurrentSteps(perTrack); // playhead state for each track card
  }), []);
  useEffect(() => onKitLoading(setKitLoading), []);

  // Theme: reflect on <html data-theme> (CSS variables do the rest) + persist.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore persistence failures
    }
  }, [theme]);

  // Track patch + clamping + phaseOffset preservation.
  // When the user changes mode/speed/steps, recompute phaseOffset so the
  // resolver's localStep at the current global tick stays the same — no
  // playhead teleport, no audible jump. Single-clock: the only state the
  // computation needs is `gRef.current`, read from the existing onStep flow.
  const updateTrack = useCallback((id: string, patch: Partial<Track>) => {
    setTracksState((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const merged = { ...t, ...patch };
        merged.hits = Math.min(merged.hits, merged.steps);
        merged.rotation = merged.steps > 0
          ? ((merged.rotation % merged.steps) + merged.steps) % merged.steps
          : 0;
        // Keep the manual-mute overlay the same length as the pattern when
        // steps changes (preserve existing entries; collapse to undefined if
        // nothing remains muted).
        if (merged.manualMute && merged.manualMute.length !== merged.steps) {
          const resized = new Array<boolean>(merged.steps).fill(false);
          const n = Math.min(merged.steps, merged.manualMute.length);
          for (let i = 0; i < n; i++) resized[i] = merged.manualMute[i];
          merged.manualMute = resized.some(Boolean) ? resized : undefined;
        }

        // Preserve musical phase when playback params or steps change.
        const oldMode: PlaybackMode = t.playbackMode ?? 'forward';
        const oldSpeed: PlaybackSpeed = t.playbackSpeed ?? 1;
        const newMode: PlaybackMode = merged.playbackMode ?? 'forward';
        const newSpeed: PlaybackSpeed = merged.playbackSpeed ?? 1;
        const playbackChanged =
          oldMode !== newMode || oldSpeed !== newSpeed || t.steps !== merged.steps;
        if (playbackChanged && gRef.current >= 0 && t.steps > 0 && merged.steps > 0) {
          merged.phaseOffset = computePhaseOffsetForChange(
            gRef.current,
            oldMode, oldSpeed, t.phaseOffset ?? 0, t.steps,
            newMode, newSpeed, merged.steps,
          );
        }
        return merged;
      })
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

  return (
    <main className="app">
      <header>
        <h1>Euclidean Rhythm Reactor</h1>
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
        <label className="bpm">
          Tempo
          <input
            type="range"
            min={40}
            max={240}
            value={bpm}
            onChange={(e) => setTempo(Number(e.target.value))}
          />
          <b>{bpm} BPM</b>
        </label>
        <label className="swing">
          Swing
          <input
            type="range"
            min={0}
            max={100}
            value={swing}
            onChange={(e) => setSwingState(Number(e.target.value))}
          />
          <b>{swing}%</b>
        </label>
        <DrumKitSelect value={kitId} loading={kitLoading} onChange={handleKitChange} />
        <button
          type="button"
          className="export"
          onClick={handleExportMidi}
          title={`Export ${EXPORT_BARS} bars as a Standard MIDI File`}
        >
          ⤓ MIDI
        </button>
        <label className="theme-select">
          Theme
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeId)}
            aria-label="Visual theme"
          >
            <option value="dark">Dark Neon</option>
            <option value="paper">Vintage Paper</option>
          </select>
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
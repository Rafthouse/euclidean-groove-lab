import { useCallback, useEffect, useState } from 'react';
import TrackCard from './components/TrackCard';
import DrumKitSelect from './components/DrumKitSelect';
import { defaultTracks, renderMidi, serializeMidi } from './engine';
import type { Track } from './engine';
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
  const [currentStep, setCurrentStep] = useState(-1);
  const [kitId, setKitId] = useState<DrumKitId>('cr78');
  const [kitLoading, setKitLoading] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(initialTheme);

  // Engine -> audio sync.
  useEffect(() => setTracks(tracks), [tracks]);
  useEffect(() => setBpm(bpm), [bpm]);
  useEffect(() => setSwing(swing / 100), [swing]);
  useEffect(() => onStep(setCurrentStep), []);
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

  // Keep hits/rotation valid as steps shrinks.
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
      setCurrentStep(-1);
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
            currentStep={currentStep}
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
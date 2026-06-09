import { useCallback, useEffect, useState } from 'react';
import TrackCard from './components/TrackCard';
import DrumKitSelect from './components/DrumKitSelect';
import { defaultTracks } from './engine';
import type { Track } from './engine';
import { start, stop, setTracks, setBpm, onStep, switchDrumKit,
  onKitLoading } from './audio';
import type { DrumKitId } from './drumKits';

export default function App() {
  const [tracks, setTracksState] = useState<Track[]>(() => defaultTracks());
  const [bpm, setTempo] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [kitId, setKitId] = useState<DrumKitId>('cr78');
  const [kitLoading, setKitLoading] = useState(false);

  // Engine -> audio sync.
  useEffect(() => setTracks(tracks), [tracks]);
  useEffect(() => setBpm(bpm), [bpm]);
  useEffect(() => onStep(setCurrentStep), []);
  useEffect(() => onKitLoading(setKitLoading), []);

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

  return (
    <main className="app">
      <header>
        <h1>Groove Lab</h1>
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
        <DrumKitSelect value={kitId} loading={kitLoading} onChange={handleKitChange} />
      </section>

      <p className="note">
        Sample-based drums (CR-78, Kit-8, KPR-77) with triangle-wave synth bass.
        Switch kits live — Transport keeps running.
      </p>
    </main>
  );
}
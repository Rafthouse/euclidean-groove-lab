import { DRUM_KITS } from '../drumKits';
import type { DrumKitId } from '../drumKits';

interface DrumKitSelectProps {
  value: DrumKitId;
  loading: boolean;
  onChange: (id: DrumKitId) => void;
}

export default function DrumKitSelect({ value, loading, onChange }: DrumKitSelectProps) {
  return (
    <label className="kit-select">
      Drum Kit
      <select
        value={value}
        disabled={loading}
        onChange={(e) => onChange(e.target.value as DrumKitId)}
      >
        {Object.values(DRUM_KITS).map((kit) => (
          <option key={kit.id} value={kit.id}>
            {kit.name}
          </option>
        ))}
      </select>
      {loading && <span className="kit-loading">loading…</span>}
    </label>
  );
}
/**
 * Pattern Bank Controls — import/export/reset for per-track pattern slots.
 *
 * Renders a small toolbar with:
 *   - Export Bank → downloads JSON
 *   - Import Bank → file picker → validate → apply
 *   - Reset Bank → confirmation → clear all saved slots
 *
 * Kept separate from Preset Browser. Pattern Bank = per-track Euclidean snapshots,
 * Preset Browser = full 4-track groove snapshots with name/category/tags.
 */

import { useRef, useState } from 'react';
import type { Track } from '../engine/track';
import {
  exportPatternBank,
  importPatternBank,
  resetPatternBank,
  savePatternBank,
  hasSavedBank,
} from '../engine/patternBank';

interface PatternBankControlsProps {
  tracks: Track[];
  onRestore: (tracks: Track[]) => void;
}

export default function PatternBankControls({
  tracks,
  onRestore,
}: PatternBankControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saved, setSaved] = useState(hasSavedBank());

  const handleExport = () => {
    const json = exportPatternBank(tracks);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pattern-bank-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const state = importPatternBank(reader.result as string);
        savePatternBank(
          tracks.map((t) => {
            const savedTrack = state.tracks.find((st) => st.id === t.id);
            if (!savedTrack) return t;
            return {
              ...t,
              patterns: savedTrack.patterns,
              activePattern: savedTrack.activePattern,
            };
          }),
        );
        onRestore(tracks);
        setSaved(true);
      } catch (err: any) {
        setImportError(err.message ?? 'Invalid file');
      }
    };
    reader.readAsText(file);

    // Reset file input so the same file can be re-imported
    e.target.value = '';
  };

  const handleReset = () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true);
      return;
    }
    resetPatternBank();
    setShowResetConfirm(false);
    setSaved(false);
    // Clear all patterns from tracks
    onRestore(
      tracks.map((t) => ({
        ...t,
        patterns: undefined,
        activePattern: 0,
      })),
    );
  };

  const handleCancelReset = () => {
    setShowResetConfirm(false);
  };

  return (
    <div className="pattern-bank-controls">
      <button
        type="button"
        className="pattern-bank-btn"
        onClick={handleExport}
        title="Export all 88 pattern slots as JSON"
      >
        ⬇ Export
      </button>

      <button
        type="button"
        className="pattern-bank-btn"
        onClick={handleImport}
        title="Import pattern bank from JSON file"
      >
        ⬆ Import
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      <button
        type="button"
        className={'pattern-bank-btn' + (showResetConfirm ? ' is-danger' : '')}
        onClick={showResetConfirm ? handleReset : handleReset}
        title={showResetConfirm ? 'Click again to confirm reset' : 'Reset all pattern slots'}
      >
        {showResetConfirm ? 'Confirm?' : '⟳ Reset'}
      </button>

      {showResetConfirm && (
        <button
          type="button"
          className="pattern-bank-btn"
          onClick={handleCancelReset}
          title="Cancel reset"
        >
          ✕
        </button>
      )}

      {saved && (
        <span className="pattern-bank-status" title="Bank has saved data">
          ●
        </span>
      )}

      {importError && (
        <span className="pattern-bank-error" title={importError}>
          ⚠ {importError}
        </span>
      )}
    </div>
  );
}

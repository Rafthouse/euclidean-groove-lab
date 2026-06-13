/**
 * PresetBrowser — two-tier preset management UI.
 *
 * Displays factory presets (read-only for normal users) and user presets
 * (full CRUD).  Developer Mode unlocks the PresetEditor for factory presets.
 *
 * Roles:
 *   USER  → browse, create/edit/delete own presets
 *   ADMIN → same + edit/publish factory presets (via Developer Mode)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Preset, GrooveSnapshot } from '../engine/preset';
import { getFactoryPresets, cloneGroove } from '../engine/preset';
import {
  loadUserPresets,
  saveUserPreset,
  updateUserPreset,
  deleteUserPreset,
  duplicateUserPreset,
} from '../engine/presetStorage';
import PresetEditor from './PresetEditor';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresetBrowserProps {
  open: boolean;
  onClose: () => void;
  /** Called when a preset is selected for loading into the groovebox. */
  onLoadPreset: (groove: GrooveSnapshot) => void;
  /** Current groovebox state — used when saving a new preset. */
  currentGroove: GrooveSnapshot;
  /** Whether developer/admin mode is active. */
  developerMode: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PresetBrowser({
  open,
  onClose,
  onLoadPreset,
  currentGroove,
  developerMode,
}: PresetBrowserProps) {
  const [search, setSearch] = useState('');
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [editingFactory, setEditingFactory] = useState<Preset | null>(null);
  const [message, setMessage] = useState('');

  // Load user presets on mount
  useEffect(() => {
    if (open) {
      loadUserPresets().then(setUserPresets).catch(console.error);
      setSearch('');
      setSelectedPreset(null);
      setEditingPreset(null);
      setEditingFactory(null);
      setMessage('');
    }
  }, [open]);

  const factoryPresets = useMemo(() => getFactoryPresets(), []);

  const filteredFactory = useMemo(
    () =>
      factoryPresets.filter(
        (p) =>
          !search ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
      ),
    [factoryPresets, search],
  );

  const filteredUser = useMemo(
    () =>
      userPresets.filter(
        (p) =>
          !search ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
      ),
    [userPresets, search],
  );

  const handleLoad = useCallback(
    (preset: Preset) => {
      onLoadPreset(preset.groove);
      onClose();
    },
    [onLoadPreset, onClose],
  );

  const handleSaveAsNew = useCallback(async () => {
    const name = prompt('Preset name:');
    if (!name) return;
    try {
      const saved = await saveUserPreset({
        name,
        category: 'User',
        description: '',
        tags: [],
        groove: cloneGroove(currentGroove),
      });
      setUserPresets((prev) => [...prev, saved]);
      setMessage(`Saved "${name}"`);
    } catch (e) {
      setMessage('Save failed');
      console.error(e);
    }
  }, [currentGroove]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this preset?')) return;
    try {
      await deleteUserPreset(id);
      setUserPresets((prev) => prev.filter((p) => p.id !== id));
      setSelectedPreset(null);
    } catch (e) {
      setMessage('Delete failed');
      console.error(e);
    }
  }, []);

  const handleDuplicate = useCallback(
    async (id: string) => {
      try {
        const dup = await duplicateUserPreset(id);
        if (dup) {
          setUserPresets((prev) => [...prev, dup]);
          setSelectedPreset(dup);
          setMessage(`Duplicated as "${dup.name}"`);
        }
      } catch (e) {
        setMessage('Duplicate failed');
        console.error(e);
      }
    },
    [],
  );

  const handleUpdateCurrent = useCallback(
    async (preset: Preset) => {
      const updated = await updateUserPreset(preset.id, {
        name: preset.name,
        category: preset.category,
        description: preset.description,
        tags: preset.tags,
        groove: cloneGroove(currentGroove),
      });
      if (updated) {
        setUserPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setEditingPreset(null);
        setMessage(`Updated "${updated.name}"`);
      }
    },
    [currentGroove],
  );

  if (!open) return null;

  return (
    <div className="preset-browser-overlay" onClick={onClose}>
      <div className="preset-browser" onClick={(e) => e.stopPropagation()}>
        <header className="preset-browser-header">
          <h2>Presets</h2>
          <button type="button" className="preset-browser-close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="preset-browser-search">
          <input
            type="text"
            placeholder="Search presets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search presets"
          />
        </div>

        {message && <div className="preset-browser-message">{message}</div>}

        {/* Editing pane for user presets */}
        {editingPreset && (
          <PresetEditor
            preset={editingPreset}
            onSave={(data) =>
              updateUserPreset(editingPreset.id, data).then((updated) => {
                if (updated) {
                  setUserPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                  setEditingPreset(null);
                  setMessage(`Updated "${updated.name}"`);
                }
              })
            }
            onCancel={() => setEditingPreset(null)}
            canEditCategory
          />
        )}

        {/* Editing pane for factory presets (admin only) */}
        {editingFactory && developerMode && (
          <PresetEditor
            preset={editingFactory}
            onSave={(data) => {
              // In v1 factory edits are ephemeral (no persistent write-back).
              // A real backend would PATCH the factory preset here.
              setMessage(`Factory preset edited (ephemeral in v1). "${data.name}" updated in session.`);
              setEditingFactory(null);
            }}
            onCancel={() => setEditingFactory(null)}
            canEditCategory
            factoryMode
          />
        )}

        <div className="preset-browser-lists">
          {/* Factory presets */}
          <section className="preset-browser-section">
            <h3>Factory</h3>
            {filteredFactory.length === 0 && (
              <p className="preset-browser-empty">No factory presets match.</p>
            )}
            {filteredFactory.map((preset) => (
              <PresetRow
                key={preset.id}
                preset={preset}
                selected={selectedPreset?.id === preset.id}
                onSelect={() => setSelectedPreset(preset)}
                onLoad={() => handleLoad(preset)}
                onEdit={
                  developerMode
                    ? () => {
                        setEditingFactory(preset);
                        setEditingPreset(null);
                      }
                    : undefined
                }
              />
            ))}
          </section>

          {/* User presets */}
          <section className="preset-browser-section">
            <h3>
              User
              <button type="button" className="preset-browser-save-current" onClick={handleSaveAsNew}>
                + Save Current
              </button>
            </h3>
            {filteredUser.length === 0 && (
              <p className="preset-browser-empty">
                {search ? 'No user presets match.' : 'No user presets yet. Save your current groove!'}
              </p>
            )}
            {filteredUser.map((preset) => (
              <PresetRow
                key={preset.id}
                preset={preset}
                selected={selectedPreset?.id === preset.id}
                onSelect={() => setSelectedPreset(preset)}
                onLoad={() => handleLoad(preset)}
                onEdit={() => {
                  setEditingPreset(preset);
                  setEditingFactory(null);
                }}
                onDelete={() => handleDelete(preset.id)}
                onDuplicate={() => handleDuplicate(preset.id)}
                onUpdateCurrent={() => handleUpdateCurrent(preset)}
              />
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresetRow — a single preset in the browser list
// ---------------------------------------------------------------------------

interface PresetRowProps {
  preset: Preset;
  selected: boolean;
  onSelect: () => void;
  onLoad: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onUpdateCurrent?: () => void;
}

function PresetRow({
  preset,
  selected,
  onSelect,
  onLoad,
  onEdit,
  onDelete,
  onDuplicate,
  onUpdateCurrent,
}: PresetRowProps) {
  return (
    <div
      className={
        'preset-browser-row' +
        (selected ? ' preset-browser-row--selected' : '') +
        (preset.kind === 'factory' ? ' preset-browser-row--factory' : '')
      }
      onClick={onSelect}
    >
      <div className="preset-row-info">
        <span className="preset-row-name">
          {preset.kind === 'factory' && <span className="preset-row-badge">F</span>}
          {preset.name}
        </span>
        <span className="preset-row-meta">
          {preset.category} · {preset.groove.bpm} BPM
        </span>
        {preset.description && (
          <span className="preset-row-desc">{preset.description}</span>
        )}
        {preset.tags.length > 0 && (
          <span className="preset-row-tags">
            {preset.tags.map((t) => (
              <span key={t} className="preset-row-tag">
                {t}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="preset-row-actions">
        <button type="button" className="preset-row-load" onClick={onLoad} title="Load preset">
          Load
        </button>
        {onEdit && (
          <button type="button" className="preset-row-edit" onClick={onEdit} title="Edit preset">
            Edit
          </button>
        )}
        {onDuplicate && (
          <button type="button" className="preset-row-dup" onClick={onDuplicate} title="Duplicate">
            Dup
          </button>
        )}
        {onUpdateCurrent && (
          <button type="button" className="preset-row-upd" onClick={onUpdateCurrent} title="Overwrite with current state">
            Overwrite
          </button>
        )}
        {onDelete && (
          <button type="button" className="preset-row-del" onClick={onDelete} title="Delete preset">
            Del
          </button>
        )}
      </div>
    </div>
  );
}

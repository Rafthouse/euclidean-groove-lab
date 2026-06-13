/**
 * PresetEditor — edit a preset's metadata (name, category, description, tags).
 *
 * For user presets: full CRUD on metadata.
 * For factory presets (developer mode): ephemeral in v1.
 */

import { useState } from 'react';
import type { Preset, PresetData } from '../engine/preset';
import { FACTORY_CATEGORIES } from '../engine/preset';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresetEditorProps {
  preset: Preset;
  onSave: (data: Partial<PresetData>) => void;
  onCancel: () => void;
  canEditCategory?: boolean;
  factoryMode?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PresetEditor({
  preset,
  onSave,
  onCancel,
  canEditCategory,
  factoryMode,
}: PresetEditorProps) {
  const [name, setName] = useState(preset.name);
  const [category, setCategory] = useState(preset.category);
  const [description, setDescription] = useState(preset.description);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([...preset.tags]);

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((x) => x !== t));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = () => {
    onSave({ name, category, description, tags });
  };

  const allCategories = canEditCategory
    ? [...FACTORY_CATEGORIES, 'User', 'Uncategorised']
    : ['User', 'Uncategorised'];

  return (
    <div className="preset-editor">
      <h4>{factoryMode ? 'Factory Preset Editor' : 'Edit Preset'}</h4>

      <label className="preset-editor-field">
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Preset name"
        />
      </label>

      <label className="preset-editor-field">
        Category
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          disabled={!canEditCategory}
          aria-label="Preset category"
        >
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="preset-editor-field">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          aria-label="Preset description"
        />
      </label>

      <label className="preset-editor-field">
        Tags
        <div className="preset-editor-tags">
          {tags.map((t) => (
            <span key={t} className="preset-editor-tag">
              {t}
              <button type="button" onClick={() => handleRemoveTag(t)} aria-label={`Remove tag ${t}`}>
                ✕
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Add tag…"
            aria-label="Add tag"
          />
        </div>
      </label>

      <div className="preset-editor-actions">
        <button type="button" className="preset-editor-save" onClick={handleSave}>
          Save
        </button>
        <button type="button" className="preset-editor-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

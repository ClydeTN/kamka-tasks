import { useState } from 'react';
import type { Tag } from '../types';

interface Props {
  tags: Tag[];
  selected: string | null;
  onSelect: (name: string | null) => void;
  onCreate: (name: string, color: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const PRESET_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export default function TagBar({ tags, selected, onSelect, onCreate, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(PRESET_COLORS[0]!);

  return (
    <div className="card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`chip border ${
            selected === null
              ? 'border-ink bg-ink text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          all
        </button>
        {tags.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.name === selected ? null : t.name)}
            className={`chip border transition ${
              selected === t.name ? 'border-transparent text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            style={selected === t.name ? { backgroundColor: t.color } : { color: t.color }}
            title={`filter to ${t.name}`}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: selected === t.name ? '#fff' : t.color }}
            />
            {t.name}
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`delete tag "${t.name}"?`)) onDelete(t.id);
              }}
              className="ml-1 opacity-60 hover:opacity-100"
            >
              ×
            </span>
          </button>
        ))}
        {adding ? (
          <form
            className="flex items-center gap-1"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              await onCreate(name.trim(), color);
              setName('');
              setAdding(false);
            }}
          >
            <input
              autoFocus
              className="input !w-28 !py-1 !text-xs"
              placeholder="new tag"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="flex gap-0.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-5 w-5 rounded-full border ${color === c ? 'border-ink' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <button type="submit" className="btn-primary !px-2 !py-1 !text-xs">add</button>
            <button type="button" onClick={() => setAdding(false)} className="btn-ghost !px-2 !py-1 !text-xs">
              cancel
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="btn-ghost !px-2 !py-1 !text-xs">
            + tag
          </button>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { api } from '../api';
import type { Priority, Tag } from '../types';

interface Props {
  tags: Tag[];
  onCreate: () => void;
}

export default function TaskForm({ tags, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  function toggleTag(id: number) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.createTask({
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        priority,
        tag_ids: selectedTagIds.length ? selectedTagIds : undefined,
      });
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('medium');
      setSelectedTagIds([]);
      setExpanded(false);
      onCreate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-3 space-y-2">
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="What needs doing?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setExpanded(true)}
          required
        />
        <button type="submit" className="btn-primary" disabled={busy || !title.trim()}>
          {busy ? '…' : 'add'}
        </button>
      </div>
      {expanded && (
        <div className="space-y-2 pt-1">
          <textarea
            className="input min-h-[60px] resize-y"
            placeholder="description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              due
              <input
                type="date"
                className="input !w-auto !py-1 !text-xs"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              priority
              <select
                className="input !w-auto !py-1 !text-xs"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tags.map((t) => {
                const on = selectedTagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className="chip border transition"
                    style={
                      on
                        ? { backgroundColor: t.color, borderColor: 'transparent', color: '#fff' }
                        : { borderColor: t.color, color: t.color }
                    }
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </form>
  );
}

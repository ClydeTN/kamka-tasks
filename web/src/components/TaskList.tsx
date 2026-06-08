import type { Task } from '../types';

interface Props {
  tasks: Task[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onToggle: (id: number, done: boolean) => void;
  onDelete: (id: number) => void;
}

const PRIORITY_TONE: Record<Task['priority'], string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-rose-100 text-rose-700',
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TaskList({ tasks, selectedId, onSelect, onToggle, onDelete }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="card p-10 text-center text-sm text-slate-500">
        nothing here yet.
      </div>
    );
  }
  const today = todayISO();
  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const due = t.dueDate ? t.dueDate.slice(0, 10) : null;
        const overdue = !t.done && due !== null && due < today;
        return (
          <li
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`card flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:shadow ${
              selectedId === t.id ? 'ring-2 ring-ink' : ''
            } ${t.done ? 'opacity-60' : ''}`}
          >
            <input
              type="checkbox"
              checked={t.done}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onToggle(t.id, e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-slate-300"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`truncate text-sm ${t.done ? 'line-through' : ''}`}>{t.title}</span>
                <span className={`chip ${PRIORITY_TONE[t.priority]}`}>{t.priority}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                {due && (
                  <span className={overdue ? 'text-rose-600' : ''}>
                    due {due}{overdue ? ' · overdue' : ''}
                  </span>
                )}
                {t.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="chip border"
                    style={{ borderColor: tag.color, color: tag.color }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(t.id);
              }}
              className="text-slate-400 hover:text-rose-600"
              title="delete"
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}

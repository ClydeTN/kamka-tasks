import type { Activity } from '../types';

interface Props {
  entries: Activity[];
}

const TYPE_TONE: Record<string, string> = {
  created: 'bg-sky-100 text-sky-700',
  updated: 'bg-slate-100 text-slate-600',
  completed: 'bg-emerald-100 text-emerald-700',
  deleted: 'bg-rose-100 text-rose-700',
  comment_added: 'bg-indigo-100 text-indigo-700',
  due_reminder: 'bg-amber-100 text-amber-700',
};

function describe(a: Activity): string {
  const payload = (a.payload ?? {}) as Record<string, unknown>;
  const title = typeof payload.title === 'string' ? payload.title : null;
  switch (a.type) {
    case 'created':
      return `created${title ? ` "${title}"` : ''}`;
    case 'completed':
      return `marked done${title ? ` "${title}"` : ''}`;
    case 'deleted':
      return `deleted${title ? ` "${title}"` : ''}`;
    case 'comment_added':
      return `comment added`;
    case 'due_reminder':
      return `due reminder fired${title ? ` for "${title}"` : ''}`;
    case 'updated':
      return `updated ${Array.isArray(payload.fields) ? `(${(payload.fields as string[]).join(', ')})` : ''}`;
    default:
      return a.type;
  }
}

export default function ActivityFeed({ entries }: Props) {
  return (
    <div className="card">
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold">activity</h2>
        <p className="text-xs text-slate-500">
          live feed — BullMQ-fired <code className="rounded bg-slate-100 px-1">due_reminder</code> jobs show up here too
        </p>
      </header>
      <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
        {entries.length === 0 && (
          <li className="px-4 py-6 text-center text-xs text-slate-400">no activity yet</li>
        )}
        {entries.map((a) => (
          <li key={a.id} className="flex items-baseline gap-2 px-4 py-2 text-sm">
            <span className={`chip ${TYPE_TONE[a.type] ?? 'bg-slate-100 text-slate-600'}`}>
              {a.type}
            </span>
            <span className="min-w-0 flex-1 truncate text-slate-700">{describe(a)}</span>
            <span className="text-xs text-slate-400">
              {new Date(a.createdAt).toLocaleTimeString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

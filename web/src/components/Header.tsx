import type { Stats } from '../types';

interface Props {
  stats: Stats;
}

export default function Header({ stats }: Props) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">tasks</h1>
          <span className="text-xs text-slate-500">a tiny ops dashboard</span>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <Stat label="total" value={stats.total} />
          <Stat label="done" value={stats.done} tone="emerald" />
          <Stat label="overdue" value={stats.overdue} tone="rose" />
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'emerald' | 'rose' }) {
  const color =
    tone === 'emerald'
      ? 'text-emerald-600'
      : tone === 'rose'
        ? 'text-rose-600'
        : 'text-slate-900';
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-lg font-semibold tabular-nums ${color}`}>{value}</span>
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Activity, Comment, Tag, Task } from '../types';

interface Props {
  task: Task;
  tags: Tag[];
  onClose: () => void;
  onUpdated: () => void;
}

export default function TaskDetail({ task, tags, onClose, onUpdated }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [newComment, setNewComment] = useState('');
  const [author, setAuthor] = useState('me');

  async function refresh() {
    const [c, a] = await Promise.all([api.listComments(task.id), api.taskActivity(task.id)]);
    setComments(c);
    setActivity(a);
  }

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 5000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  async function toggleTag(tagId: number) {
    const next = task.tags.some((t) => t.id === tagId)
      ? task.tags.filter((t) => t.id !== tagId).map((t) => t.id)
      : [...task.tags.map((t) => t.id), tagId];
    await api.patchTask(task.id, { tag_ids: next });
    onUpdated();
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    await api.addComment(task.id, newComment.trim(), author.trim() || 'anonymous');
    setNewComment('');
    refresh();
    onUpdated();
  }

  return (
    <div className="card overflow-hidden">
      <header className="flex items-start justify-between border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{task.title}</h2>
          <p className="text-xs text-slate-500">
            #{task.id} · {task.priority} · {task.dueDate ? `due ${task.dueDate.slice(0, 10)}` : 'no due date'}
          </p>
        </div>
        <button onClick={onClose} className="btn-ghost !p-1" aria-label="close">×</button>
      </header>

      {task.description && (
        <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
          {task.description}
        </div>
      )}

      <section className="border-b border-slate-100 px-4 py-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">tags</h3>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const on = task.tags.some((t) => t.id === tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className="chip border"
                style={
                  on
                    ? { backgroundColor: tag.color, borderColor: 'transparent', color: '#fff' }
                    : { borderColor: tag.color, color: tag.color }
                }
              >
                {tag.name}
              </button>
            );
          })}
          {tags.length === 0 && <span className="text-xs text-slate-400">no tags yet</span>}
        </div>
      </section>

      <section className="border-b border-slate-100 px-4 py-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          comments ({comments.length})
        </h3>
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <div className="flex items-baseline justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-700">{c.author}</span>
                <span>{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-slate-800 whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
          {comments.length === 0 && <li className="text-xs text-slate-400">no comments yet</li>}
        </ul>
        <form onSubmit={addComment} className="mt-3 space-y-2">
          <input
            className="input !py-1 !text-xs"
            placeholder="your name"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <textarea
            className="input min-h-[60px] resize-y"
            placeholder="add a comment…"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={!newComment.trim()}>
            comment
          </button>
        </form>
      </section>

      <section className="px-4 py-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">activity</h3>
        <ul className="space-y-1 max-h-48 overflow-y-auto text-xs">
          {activity.map((a) => (
            <li key={a.id} className="flex items-baseline gap-2 text-slate-600">
              <span className="text-slate-400">{new Date(a.createdAt).toLocaleTimeString()}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                {a.type}
              </span>
            </li>
          ))}
          {activity.length === 0 && <li className="text-xs text-slate-400">no activity yet</li>}
        </ul>
      </section>
    </div>
  );
}

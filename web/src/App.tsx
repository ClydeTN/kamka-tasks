import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { Activity, Stats, Tag, Task } from './types';
import Header from './components/Header';
import TagBar from './components/TagBar';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import TaskDetail from './components/TaskDetail';
import ActivityFeed from './components/ActivityFeed';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, done: 0, overdue: 0 });
  const [activity, setActivity] = useState<Activity[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [t, tg, s, a] = await Promise.all([
        api.listTasks(selectedTag ? { tag: selectedTag } : {}),
        api.listTags(),
        api.stats(),
        api.globalActivity(30),
      ]);
      setTasks(t);
      setTags(tg);
      setStats(s);
      setActivity(a);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load');
    }
  }, [selectedTag]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // poll the activity feed every 5s so BullMQ-fired due_reminders show up
  // without needing a manual refresh
  useEffect(() => {
    const t = window.setInterval(async () => {
      try {
        const a = await api.globalActivity(30);
        setActivity(a);
        const s = await api.stats();
        setStats(s);
      } catch {
        /* swallow polling errors */
      }
    }, 5000);
    return () => window.clearInterval(t);
  }, []);

  const selectedTask = selectedTaskId != null ? tasks.find((t) => t.id === selectedTaskId) ?? null : null;

  return (
    <div className="min-h-full">
      <Header stats={stats} />
      {error && (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        </div>
      )}
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-4">
          <TagBar
            tags={tags}
            selected={selectedTag}
            onSelect={setSelectedTag}
            onCreate={async (name, color) => {
              await api.createTag(name, color);
              refresh();
            }}
            onDelete={async (id) => {
              await api.deleteTag(id);
              refresh();
            }}
          />
          <TaskForm tags={tags} onCreate={refresh} />
          <TaskList
            tasks={tasks}
            selectedId={selectedTaskId}
            onSelect={setSelectedTaskId}
            onToggle={async (id, done) => {
              await api.patchTask(id, { done });
              refresh();
            }}
            onDelete={async (id) => {
              await api.deleteTask(id);
              if (selectedTaskId === id) setSelectedTaskId(null);
              refresh();
            }}
          />
        </section>

        <aside className="space-y-4">
          {selectedTask ? (
            <TaskDetail
              task={selectedTask}
              tags={tags}
              onClose={() => setSelectedTaskId(null)}
              onUpdated={refresh}
            />
          ) : (
            <ActivityFeed entries={activity} />
          )}
        </aside>
      </main>
    </div>
  );
}

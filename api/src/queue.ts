import { Queue, type ConnectionOptions } from 'bullmq';
import { env } from './env';

// parse REDIS_URL into a plain options object — letting bullmq construct
// its own ioredis avoids a duplicate-dep clash with whatever version we'd
// pin ourselves
function parseRedisUrl(url: string): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 6379,
    password: u.password || undefined,
    username: u.username || undefined,
    db: u.pathname && u.pathname.length > 1 ? parseInt(u.pathname.slice(1), 10) : 0,
    maxRetriesPerRequest: null,
  };
}

export const queueConnection = parseRedisUrl(env.REDIS_URL);
export const DUE_QUEUE = 'due-reminders';

export type DueReminderJob = { taskId: number };

export const dueQueue: Queue<DueReminderJob, void, 'due'> = new Queue<DueReminderJob, void, 'due'>(
  DUE_QUEUE,
  { connection: queueConnection }
);

// schedule a one-shot reminder for a task. delay clamps to 0 so past-due
// tasks fire immediately and show up in the activity feed.
export async function scheduleDueReminder(taskId: number, dueDate: string | null): Promise<void> {
  if (!dueDate) return;
  const due = new Date(dueDate + 'T09:00:00Z').getTime();
  const delay = Math.max(0, due - Date.now());
  await dueQueue.add(
    'due',
    { taskId },
    {
      delay,
      jobId: `task-${taskId}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );
}

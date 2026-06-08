const { Worker } = require('bullmq');
const { Pool } = require('pg');
const fs = require('fs');

const heartbeatPath = process.env.HEARTBEAT_PATH || '/tmp/worker-alive';

function touchHeartbeat() {
  try {
    fs.writeFileSync(heartbeatPath, String(Date.now()));
  } catch (e) {
    console.error('[worker] heartbeat write failed', e.message);
  }
}

function parseRedisUrl(url) {
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

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const connection = parseRedisUrl(process.env.REDIS_URL);

// the only thing this worker does: when a "due" reminder fires, check if
// the task still exists and isn't done, then drop a row in `activity` so
// the api/frontend can show it. one job type, kept deliberately simple.
const worker = new Worker(
  'due-reminders',
  async (job) => {
    const { taskId } = job.data;
    const { rows } = await pool.query(
      'SELECT id, title, due_date, done FROM tasks WHERE id = $1',
      [taskId]
    );
    const task = rows[0];
    if (!task) {
      console.log(`[due-reminder] task ${taskId} no longer exists`);
      return { skipped: 'missing' };
    }
    if (task.done) {
      console.log(`[due-reminder] task ${taskId} "${task.title}" already done`);
      return { skipped: 'done' };
    }
    const dueStr =
      task.due_date instanceof Date
        ? task.due_date.toISOString().slice(0, 10)
        : String(task.due_date);
    console.log(`[due-reminder] task ${taskId} "${task.title}" is due ${dueStr}`);
    await pool.query(
      `INSERT INTO activity (task_id, type, payload) VALUES ($1, 'due_reminder', $2)`,
      [taskId, JSON.stringify({ title: task.title, dueDate: dueStr })]
    );
    return { logged: true };
  },
  { connection, concurrency: 4 }
);

worker.on('completed', (job) => {
  console.log(`[worker] job ${job.id} done`);
  touchHeartbeat();
});

worker.on('failed', (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});

worker.on('ready', () => {
  console.log('worker ready, consuming due-reminders');
  touchHeartbeat();
});

// keep the healthcheck happy while the queue is idle
setInterval(touchHeartbeat, 30000);

async function shutdown() {
  console.log('worker shutting down');
  await worker.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

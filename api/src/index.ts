import express from 'express';
import { env } from './env';
import { pool, runMigrations } from './db';
import { cache } from './cache';
import tasksRouter from './routes/tasks';
import tagsRouter from './routes/tags';
import commentsRouter from './routes/comments';
import activityRouter, { taskRouter as taskActivityRouter } from './routes/activity';
import { errorHandler } from './lib/errors';

const app = express();
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    await cache.ping();
    res.json({ status: 'ok' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    res.status(503).json({ status: 'error', error: message });
  }
});

app.use('/api/tasks/:taskId/comments', commentsRouter);
app.use('/api/tasks/:taskId/activity', taskActivityRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/activity', activityRouter);
app.use(errorHandler);

async function start(): Promise<void> {
  await runMigrations();
  await cache.connect();
  app.listen(env.PORT, () => {
    console.log(`api listening on ${env.PORT}`);
  });
}

start().catch((err) => {
  console.error('failed to start', err);
  process.exit(1);
});

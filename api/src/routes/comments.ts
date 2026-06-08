import { Router } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { comments, tasks } from '../db/schema';
import { HttpError } from '../lib/errors';
import { logActivity } from '../lib/activity';

const router: Router = Router({ mergeParams: true });

const idParam = z.coerce.number().int().positive();

const createBody = z.object({
  body: z.string().trim().min(1).max(1000),
  author: z.string().trim().min(1).max(40).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const taskId = idParam.parse((req.params as { taskId: string }).taskId);
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.taskId, taskId))
      .orderBy(desc(comments.createdAt));
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const taskId = idParam.parse((req.params as { taskId: string }).taskId);
    const body = createBody.parse(req.body);

    const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId));
    if (!task) throw new HttpError(404, 'task not found');

    const [row] = await db
      .insert(comments)
      .values({
        taskId,
        body: body.body,
        author: body.author ?? 'anonymous',
      })
      .returning();

    await logActivity(taskId, 'comment_added', { author: row?.author });
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

export default router;

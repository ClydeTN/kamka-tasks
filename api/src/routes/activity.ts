import { Router } from 'express';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { activity } from '../db/schema';

const router: Router = Router();

const idParam = z.coerce.number().int().positive();
const limitQuery = z.coerce.number().int().positive().max(200).default(50);

// flat feed across all tasks
router.get('/', async (req, res, next) => {
  try {
    const limit = limitQuery.parse(req.query.limit ?? '50');
    const rows = await db
      .select()
      .from(activity)
      .orderBy(desc(activity.createdAt))
      .limit(limit);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// feed for a single task — mounted under /api/tasks/:taskId/activity
const taskRouter: Router = Router({ mergeParams: true });
taskRouter.get('/', async (req, res, next) => {
  try {
    const taskId = idParam.parse((req.params as { taskId: string }).taskId);
    const rows = await db
      .select()
      .from(activity)
      .where(eq(activity.taskId, taskId))
      .orderBy(desc(activity.createdAt));
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

export { taskRouter };
export default router;

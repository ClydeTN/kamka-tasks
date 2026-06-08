import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, sql, and, inArray } from 'drizzle-orm';
import { db } from '../db';
import { tasks, tags, taskTags } from '../db/schema';
import { cache } from '../cache';
import { HttpError } from '../lib/errors';
import { logActivity } from '../lib/activity';
import { scheduleDueReminder } from '../queue';

const router: Router = Router();

const LIST_TTL = 30;
const listKey = (tag: string | null, done: string | null): string =>
  `tasks:list:${tag ?? '-'}:${done ?? '-'}`;

const idParam = z.coerce.number().int().positive();

const createBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  due_date: z.string().date().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
});

const patchBody = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  due_date: z.string().date().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  done: z.boolean().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
});

const listQuery = z.object({
  tag: z.string().optional(),
  done: z.enum(['true', 'false']).optional(),
});

type TaskRow = typeof tasks.$inferSelect;
type TagRow = typeof tags.$inferSelect;
type TaskWithTags = TaskRow & { tags: TagRow[] };

async function attachTags(rows: TaskRow[]): Promise<TaskWithTags[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const joined = await db
    .select({
      taskId: taskTags.taskId,
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(taskTags)
    .innerJoin(tags, eq(taskTags.tagId, tags.id))
    .where(inArray(taskTags.taskId, ids));

  const byTask = new Map<number, TagRow[]>();
  for (const r of joined) {
    const arr = byTask.get(r.taskId) ?? [];
    arr.push({ id: r.id, name: r.name, color: r.color });
    byTask.set(r.taskId, arr);
  }
  return rows.map((t) => ({ ...t, tags: byTask.get(t.id) ?? [] }));
}

async function invalidateList(): Promise<void> {
  // redis v5 scanIterator yields batches of keys, not individual strings.
  // the keyspace is tiny so a single SCAN pass is fine.
  for await (const batch of cache.scanIterator({ MATCH: 'tasks:list:*' })) {
    const keys = Array.isArray(batch) ? batch : [batch];
    if (keys.length > 0) await cache.del(keys);
  }
}

router.get('/', async (req, res, next) => {
  try {
    const q = listQuery.parse(req.query);
    const tag = q.tag ?? null;
    const done = q.done ?? null;
    const key = listKey(tag, done);

    const cached = await cache.get(key);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.json(JSON.parse(cached));
      return;
    }

    const conditions = [];
    if (done === 'true') conditions.push(eq(tasks.done, true));
    if (done === 'false') conditions.push(eq(tasks.done, false));

    let rows: TaskRow[];
    if (tag) {
      const tagRow = await db.select().from(tags).where(eq(tags.name, tag)).limit(1);
      if (tagRow.length === 0) {
        res.setHeader('X-Cache', 'MISS');
        res.json([]);
        return;
      }
      const taskIds = await db
        .select({ id: taskTags.taskId })
        .from(taskTags)
        .where(eq(taskTags.tagId, tagRow[0]!.id));
      const ids = taskIds.map((r) => r.id);
      if (ids.length === 0) {
        res.setHeader('X-Cache', 'MISS');
        res.json([]);
        return;
      }
      conditions.push(inArray(tasks.id, ids));
      rows = await db
        .select()
        .from(tasks)
        .where(and(...conditions))
        .orderBy(desc(tasks.createdAt));
    } else if (conditions.length > 0) {
      rows = await db
        .select()
        .from(tasks)
        .where(and(...conditions))
        .orderBy(desc(tasks.createdAt));
    } else {
      rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
    }

    const enriched = await attachTags(rows);
    await cache.set(key, JSON.stringify(enriched), { EX: LIST_TTL });
    res.setHeader('X-Cache', 'MISS');
    res.json(enriched);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = idParam.parse(req.params.id);
    const rows = await db.select().from(tasks).where(eq(tasks.id, id));
    if (rows.length === 0) throw new HttpError(404, 'not found');
    const [enriched] = await attachTags(rows);
    res.json(enriched);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = createBody.parse(req.body);
    const [row] = await db
      .insert(tasks)
      .values({
        title: body.title,
        description: body.description ?? null,
        dueDate: body.due_date ?? null,
        priority: body.priority ?? 'medium',
      })
      .returning();
    if (!row) throw new HttpError(500, 'insert failed');

    if (body.tag_ids && body.tag_ids.length > 0) {
      await db.insert(taskTags).values(body.tag_ids.map((tagId) => ({ taskId: row.id, tagId })));
    }

    await scheduleDueReminder(row.id, row.dueDate);
    await logActivity(row.id, 'created', { title: row.title, priority: row.priority });
    await invalidateList();

    const [enriched] = await attachTags([row]);
    res.status(201).json(enriched);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = idParam.parse(req.params.id);
    const body = patchBody.parse(req.body);

    const updates: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.due_date !== undefined) updates.dueDate = body.due_date;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.done !== undefined) updates.done = body.done;

    const [row] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();
    if (!row) throw new HttpError(404, 'not found');

    if (body.tag_ids !== undefined) {
      await db.delete(taskTags).where(eq(taskTags.taskId, id));
      if (body.tag_ids.length > 0) {
        await db.insert(taskTags).values(body.tag_ids.map((tagId) => ({ taskId: id, tagId })));
      }
    }

    if (body.done === true) {
      await logActivity(id, 'completed', { title: row.title });
    } else {
      await logActivity(id, 'updated', { fields: Object.keys(body) });
    }
    await invalidateList();

    const [enriched] = await attachTags([row]);
    res.json(enriched);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = idParam.parse(req.params.id);
    const [row] = await db.select({ title: tasks.title }).from(tasks).where(eq(tasks.id, id));
    if (!row) throw new HttpError(404, 'not found');
    await db.delete(tasks).where(eq(tasks.id, id));
    // activity rows for this task were cascaded; log a detached event so the
    // feed still shows the deletion
    await logActivity(null, 'deleted', { taskId: id, title: row.title });
    await invalidateList();
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// task count by status, used by the dashboard header
router.get('/_stats/summary', async (_req, res, next) => {
  try {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(*) filter (where ${tasks.done} = true)::int`,
        overdue: sql<number>`count(*) filter (where ${tasks.done} = false and ${tasks.dueDate} < current_date)::int`,
      })
      .from(tasks);
    res.json(stats);
  } catch (e) {
    next(e);
  }
});

export default router;

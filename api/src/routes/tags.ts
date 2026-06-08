import { Router } from 'express';
import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db';
import { tags } from '../db/schema';
import { HttpError } from '../lib/errors';

const router: Router = Router();

const createBody = z.object({
  name: z.string().trim().min(1).max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

const idParam = z.coerce.number().int().positive();

router.get('/', async (_req, res, next) => {
  try {
    const rows = await db.select().from(tags).orderBy(asc(tags.name));
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = createBody.parse(req.body);
    try {
      const [row] = await db
        .insert(tags)
        .values({ name: body.name, color: body.color ?? '#6b7280' })
        .returning();
      res.status(201).json(row);
    } catch (e) {
      if (e instanceof Error && e.message.includes('unique')) {
        throw new HttpError(409, 'tag already exists');
      }
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = idParam.parse(req.params.id);
    const result = await db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
    if (result.length === 0) throw new HttpError(404, 'not found');
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;

import { db } from '../db';
import { activity } from '../db/schema';

export async function logActivity(
  taskId: number | null,
  type: string,
  payload?: Record<string, unknown>
): Promise<void> {
  await db.insert(activity).values({
    taskId,
    type,
    payload: payload ?? null,
  });
}

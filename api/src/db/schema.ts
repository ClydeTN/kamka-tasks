import {
  pgTable,
  serial,
  text,
  boolean,
  date,
  timestamp,
  integer,
  jsonb,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const tasks = pgTable(
  'tasks',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    dueDate: date('due_date'),
    done: boolean('done').notNull().default(false),
    priority: text('priority', { enum: ['low', 'medium', 'high'] }).notNull().default('medium'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dueIdx: index('tasks_due_idx').on(t.dueDate),
    doneIdx: index('tasks_done_idx').on(t.done),
  })
);

export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#6b7280'),
});

export const taskTags = pgTable(
  'task_tags',
  {
    taskId: integer('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.taskId, t.tagId] }),
  })
);

export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    taskId: integer('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    author: text('author').notNull().default('anonymous'),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    taskIdx: index('comments_task_idx').on(t.taskId),
  })
);

export const activity = pgTable(
  'activity',
  {
    id: serial('id').primaryKey(),
    taskId: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    taskIdx: index('activity_task_idx').on(t.taskId),
    createdIdx: index('activity_created_idx').on(t.createdAt),
  })
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Activity = typeof activity.$inferSelect;

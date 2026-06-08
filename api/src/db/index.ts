import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { env } from '../env';
import * as schema from './schema';

export const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(__dirname, '..', '..', 'drizzle');
  await migrate(db, { migrationsFolder });
}

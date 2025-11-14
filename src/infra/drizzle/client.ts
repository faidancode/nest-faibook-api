// src/infra/drizzle/client.ts
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export async function createDrizzleClient(config: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}) {
  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: 10,
  });

  const db = drizzle(pool, { schema, mode: 'default' });

  return db;
}

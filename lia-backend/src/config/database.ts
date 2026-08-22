import { Pool } from 'pg';
import { config } from './index';

/**
 * Pool de conexiones a PostgreSQL (Supabase Session Pooler).
 * No se importa desde index.ts en esta fase para no acoplar el arranque de Express.
 */
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function testDatabaseConnection(): Promise<{ serverTime: Date }> {
  const result = await pool.query<{ server_time: Date }>('SELECT NOW() AS server_time');
  const serverTime = result.rows[0]?.server_time;

  if (!serverTime) {
    throw new Error('La consulta de prueba no devolvió server_time');
  }

  return { serverTime };
}

export async function closeDatabasePool(): Promise<void> {
  await pool.end();
}

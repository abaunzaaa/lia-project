import fs from 'fs';
import path from 'path';
import { pool, closeDatabasePool } from '../config/database';

const FILE = path.resolve(__dirname, '../../migrations/004_history_hides.sql');

async function main() {
  const sql = fs.readFileSync(FILE, 'utf8');
  await pool.query(sql);
  const check = await pool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'medication_history_hides'`
  );
  console.log(
    'Migración 004 aplicada.',
    check.rows[0] ? 'Tabla medication_history_hides lista.' : 'La tabla no apareció.'
  );
  await closeDatabasePool();
}

main().catch(async (error) => {
  console.error('No se pudo aplicar la migración 004.');
  if (error instanceof Error) console.error(error.message);
  try {
    await closeDatabasePool();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

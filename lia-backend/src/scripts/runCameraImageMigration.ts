import fs from 'fs';
import path from 'path';
import { pool, closeDatabasePool } from '../config/database';

const FILE = path.resolve(__dirname, '../../migrations/005_camera_and_medication_images.sql');

async function main() {
  const sql = fs.readFileSync(FILE, 'utf8');
  await pool.query(sql);
  const check = await pool.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND (
         (table_name = 'camera_recognition_sessions' AND column_name = 'image_url')
         OR (table_name = 'medications' AND column_name = 'image_url')
       )
     ORDER BY table_name`
  );
  console.log(
    'Migración 005 aplicada. Columnas:',
    check.rows.map((row) => `${row.table_name}.${row.column_name}`).join(', ') || '(ninguna)'
  );
  await closeDatabasePool();
}

main().catch(async (error) => {
  console.error('No se pudo aplicar la migración 005.');
  if (error instanceof Error) console.error(error.message);
  try {
    await closeDatabasePool();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

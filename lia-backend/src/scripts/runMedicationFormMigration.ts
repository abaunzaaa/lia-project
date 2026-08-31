import fs from 'fs';
import path from 'path';
import { pool, closeDatabasePool } from '../config/database';

const FILE = path.resolve(__dirname, '../../migrations/003_medication_form_fields.sql');

async function main() {
  const sql = fs.readFileSync(FILE, 'utf8');
  await pool.query(sql);
  const check = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'medications'
       AND column_name IN (
         'presentation', 'dose_amount', 'dose_unit', 'purpose',
         'weekdays', 'meal_relation', 'reminder_enabled'
       )
     ORDER BY column_name`
  );
  console.log('Migración 003 aplicada. Columnas:', check.rows.map((row) => row.column_name).join(', '));
  await closeDatabasePool();
}

main().catch(async (error) => {
  console.error('No se pudo aplicar la migración 003.');
  if (error instanceof Error) console.error(error.message);
  try {
    await closeDatabasePool();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

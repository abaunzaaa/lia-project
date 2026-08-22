async function main() {
  try {
    // Import dinámico: carga config/dotenv y crea el pool solo dentro del try
    const { testDatabaseConnection, closeDatabasePool } = await import('../config/database');
    const { serverTime } = await testDatabaseConnection();

    console.log('✅ PostgreSQL / Supabase conectado correctamente');
    console.log(`🕒 Hora del servidor: ${serverTime.toISOString()}`);

    await closeDatabasePool();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al conectar con PostgreSQL / Supabase');

    if (error instanceof Error) {
      console.error(`Detalle: ${error.message}`);
    } else {
      console.error('Detalle: error desconocido');
    }

    process.exit(1);
  }
}

main();

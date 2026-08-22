import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middleware';
import { initFirebaseAdmin } from './config/firebase';
import { config } from './config';

const app = express();

// Inicializar Firebase Admin (opcional)
initFirebaseAdmin();

// Middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rutas API
app.use('/api', routes);

// Ruta raíz
app.get('/', (_req, res) => {
  res.json({
    name: 'LIA Backend API',
    description: 'Asistente Inteligente de Medicamentos',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      recognize: 'POST /api/medications/recognize',
      chat: 'POST /api/medications/chat',
      info: 'GET /api/medications/info?name=Ibuprofeno',
    },
    esp32: {
      endpoint: 'POST /api/medications/recognize',
      headers: { 'x-device-id': 'ESP32-CAM-001', 'Content-Type': 'multipart/form-data' },
      field: 'image',
    },
  });
});

// Error handler
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`
  💙 LIA Backend API
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚀 Servidor: http://localhost:${config.port}
  📡 API:      http://localhost:${config.port}/api
  🔍 Health:   http://localhost:${config.port}/api/health
  📷 ESP32:    POST /api/medications/recognize
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

export default app;

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const MIN_BYTES = 800;
const MAX_BYTES = 8 * 1024 * 1024;
const CAMERA_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'camera');

export class CameraImageError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'CameraImageError';
  }
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

/** Guarda el JPEG de la ESP32-CAM y devuelve la ruta pública relativa. */
export async function saveCameraJpeg(buffer: Buffer): Promise<string> {
  if (!buffer || buffer.length < MIN_BYTES) {
    throw new CameraImageError(400, 'Imagen requerida.');
  }
  if (buffer.length > MAX_BYTES) {
    throw new CameraImageError(400, 'La imagen es demasiado grande.');
  }
  if (!isJpeg(buffer)) {
    throw new CameraImageError(400, 'La imagen debe ser JPEG.');
  }

  await fs.mkdir(CAMERA_UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.jpg`;
  await fs.writeFile(path.join(CAMERA_UPLOAD_DIR, filename), buffer);
  return `/uploads/camera/${filename}`;
}

/** Acepta /uploads/camera/... o una URL absoluta que apunte a esa ruta. */
export function normalizeCameraImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/uploads\/camera\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i);
  return match ? match[0] : null;
}

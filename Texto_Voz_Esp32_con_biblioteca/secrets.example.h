/**
 * secrets.example.h — plantilla versionable (sin secretos reales).
 * Copia a secrets.h y completa los valores.
 *
 * LIA_BACKEND_URL: origen del backend, sin /api.
 *   Prueba física local: "http://192.168.1.8:3000"
 * No uses 127.0.0.1 ni localhost (desde el ESP32 no es el PC).
 */

#ifndef SECRETS_H
#define SECRETS_H

#define LIA_BACKEND_URL   "http://192.168.1.8:3000"
#define LIA_DEVICE_ID     "lia-camera-01"
#define LIA_DEVICE_TOKEN  ""

#endif

/**
 * Ejemplo de integración ESP32-CAM con LIA Backend
 *
 * Hardware: ESP32-CAM (AI-Thinker)
 * Librerías: WiFi, HTTPClient, esp_camera
 *
 * Flujo:
 * 1. ESP32-CAM captura imagen del medicamento
 * 2. Envía POST multipart a /api/medications/recognize
 * 3. Backend procesa con IA y responde JSON
 * 4. ESP32 puede mostrar resultado en display o enviar a app
 *
 * Producción (Foto_Texto_new.ino):
 * - Put credentials in secrets.h (copy from secrets.example.h at repo root).
 * - secrets.h is gitignored; never commit WiFi passwords or device tokens.
 * - BACKEND_URL is base only, e.g. "http://192.168.1.100:3000" (no /api path);
 *   firmware appends /api/medications/recognize.
 */

// ─── Configuración WiFi ─────────────────────────────
// Prefer secrets.h in the real sketch; placeholders here for the example only.
const char* WIFI_SSID = "TU_RED_WIFI";
const char* WIFI_PASSWORD = "TU_PASSWORD";

// ─── Configuración LIA API ──────────────────────────
const char* LIA_API_URL = "http://192.168.1.100:3000/api/medications/recognize";
const char* DEVICE_ID = "ESP32-CAM-001";

// ─── Configuración Cámara ESP32-CAM ─────────────────
#include "esp_camera.h"

#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

void setup() {
  Serial.begin(115200);

  // Inicializar cámara
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_SVGA;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Error cámara: 0x%x\n", err);
    return;
  }

  // Conectar WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi conectado");
}

void sendToLIA() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Error captura");
    return;
  }

  HTTPClient http;
  http.begin(LIA_API_URL);
  http.addHeader("X-Device-Id", DEVICE_ID);

  // Enviar imagen como multipart/form-data
  String boundary = "----LIABoundary";
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);

  String body = "--" + boundary + "\r\n";
  body += "Content-Disposition: form-data; name=\"image\"; filename=\"medication.jpg\"\r\n";
  body += "Content-Type: image/jpeg\r\n\r\n";

  String endBoundary = "\r\n--" + boundary + "--\r\n";

  // Nota: en producción usar http.POST con payload binario completo
  int httpCode = http.POST((uint8_t*)fb->buf, fb->len);

  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("LIA Response:");
    Serial.println(response);
    // Parsear JSON: name, description, dose, confidence
  } else {
    Serial.printf("Error HTTP: %d\n", httpCode);
  }

  esp_camera_fb_return(fb);
  http.end();
}

void loop() {
  // Capturar y enviar cada 30 segundos (o al presionar botón)
  sendToLIA();
  delay(30000);
}

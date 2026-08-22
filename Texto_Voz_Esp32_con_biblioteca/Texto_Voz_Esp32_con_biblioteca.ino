#include <Arduino.h>
#include "TTSHelper.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "Audio.h"
#include "secrets.h"

#define I2S_DOUT 25
#define I2S_BCLK 27
#define I2S_LRC  32

const char* ssid = "Angie";
const char* password = "abaunza1";

TTSHelper tts(I2S_BCLK, I2S_LRC, I2S_DOUT);

static String urlResultadoLIA() {
  String base = String(LIA_BACKEND_URL);
  base.trim();
  while (base.endsWith("/")) {
    base.remove(base.length() - 1);
  }
  if (base.length() == 0) {
    return "";
  }
  return base + "/api/camera/device-result";
}

bool enviarResultadoALIA(const String& texto) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("LIA: backend no disponible; el audio continúa.");
    return false;
  }

  const String url = urlResultadoLIA();
  if (url.length() == 0) {
    Serial.println("LIA: backend no disponible; el audio continúa.");
    return false;
  }

  StaticJsonDocument<2048> doc;
  doc["deviceId"] = LIA_DEVICE_ID;
  doc["text"] = texto;

  String payload;
  if (serializeJson(doc, payload) == 0 || payload.length() == 0) {
    Serial.println("LIA: backend no disponible; el audio continúa.");
    return false;
  }

  Serial.println("LIA: enviando resultado...");

  HTTPClient http;
  http.setTimeout(3000);

  if (!http.begin(url)) {
    Serial.println("LIA: backend no disponible; el audio continúa.");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", LIA_DEVICE_ID);
  http.addHeader("X-Device-Token", LIA_DEVICE_TOKEN);

  const int code = http.POST(payload);
  http.end();

  if (code == 200) {
    Serial.println("LIA: resultado enviado correctamente.");
    return true;
  }

  Serial.println("LIA: backend no disponible; el audio continúa.");
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(3000);
  tts.conectarWiFi(ssid, password);
  tts.hablar("Conectado");
}

void loop() {
  tts.actualizarAudio();
  if (Serial.available()) {
    String texto = Serial.readStringUntil('\n');
    texto.trim();
    if (texto.length() > 0) {
      Serial.print("Tú: ");
      Serial.println(texto);
      enviarResultadoALIA(texto);
      tts.hablar(texto);
    } else {
      Serial.println("Entrada vacía.");
    }
  }
}

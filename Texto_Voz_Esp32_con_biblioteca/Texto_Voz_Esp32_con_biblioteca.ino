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


// ======================================================
// WIFI
// ======================================================

const char* ssid = "HUAWEI-FAA3";
const char* password = "T5DN517ELQD";


// ======================================================
// AUDIO
// ======================================================

// false = audio desactivado temporalmente
// true  = audio activado cuando arreglemos/cambiemos parlante
const bool AUDIO_ACTIVO = false;


TTSHelper tts(I2S_BCLK, I2S_LRC, I2S_DOUT);


// ======================================================
// URL BACKEND LIA
// ======================================================

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


// ======================================================
// ENVIAR RESULTADO AL BACKEND
// ======================================================

bool enviarResultadoALIA(const String& texto) {

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println(
      "LIA: backend no disponible."
    );

    return false;
  }


  const String url = urlResultadoLIA();

  if (url.length() == 0) {

    Serial.println(
      "LIA: backend no disponible."
    );

    return false;
  }


  StaticJsonDocument<2048> doc;

  doc["deviceId"] = LIA_DEVICE_ID;
  doc["text"] = texto;


  String payload;

  if (
    serializeJson(doc, payload) == 0 ||
    payload.length() == 0
  ) {

    Serial.println(
      "LIA: backend no disponible."
    );

    return false;
  }


  Serial.println(
    "LIA: enviando resultado..."
  );


  HTTPClient http;

  // Cloudflare puede tardar más de 3 segundos.
  http.setTimeout(10000);


  if (!http.begin(url)) {

    Serial.println(
      "LIA: backend no disponible."
    );

    return false;
  }


  http.addHeader(
    "Content-Type",
    "application/json"
  );

  http.addHeader(
    "X-Device-Id",
    LIA_DEVICE_ID
  );

  http.addHeader(
    "X-Device-Token",
    LIA_DEVICE_TOKEN
  );


  const int code = http.POST(payload);

  http.end();


  if (code == 200) {

    Serial.println(
      "LIA: resultado enviado correctamente."
    );

    return true;
  }


  Serial.print(
    "LIA: error HTTP "
  );

  Serial.println(code);

  return false;
}


// ======================================================
// DETECTAR MENSAJES TECNICOS DE LA ESP32-CAM
// ======================================================

bool esMensajeTecnico(const String& texto) {

  if (
    texto.equalsIgnoreCase("Dispositivo listo") ||

    // Brownout / problemas de alimentación de la cámara
    texto.indexOf("Brownout detector") >= 0 ||
    texto.startsWith("E BOD:") ||

    // Mensajes de arranque ESP32
    texto.indexOf(",len:") >= 0 ||
    texto.startsWith("ets ") ||
    texto.startsWith("rst:") ||
    texto.startsWith("configsip:") ||
    texto.startsWith("mode:") ||
    texto.startsWith("load:") ||
    texto.startsWith("entry ") ||
    texto.startsWith("boot:") ||
    texto.startsWith("SPIWP:") ||
    texto.startsWith("clk_drv:")
  ) {

    return true;
  }

  return false;
}


// ======================================================
// SETUP
// ======================================================

void setup() {

  Serial.begin(115200);

  delay(3000);


  // ====================================================
  // CONECTAR WIFI
  // ====================================================

  tts.conectarWiFi(
    ssid,
    password
  );


  // ====================================================
  // AUDIO
  // ====================================================

  if (AUDIO_ACTIVO) {

    tts.hablar(
      "Conectado"
    );
  }


  Serial.println(
    "Listo."
  );
}


// ======================================================
// LOOP
// ======================================================

void loop() {

  // ====================================================
  // ACTUALIZAR AUDIO
  // ====================================================

  if (AUDIO_ACTIVO) {

    tts.actualizarAudio();
  }


  // ====================================================
  // RECIBIR TEXTO DESDE ESP32-CAM
  // ====================================================

  if (Serial.available()) {

    String texto =
      Serial.readStringUntil('\n');


    texto.trim();


    if (texto.length() == 0) {

      return;
    }


    // ==================================================
    // IGNORAR MENSAJES TECNICOS DE ARRANQUE
    // ==================================================

    if (esMensajeTecnico(texto)) {

      Serial.print(
        "Ignorado: "
      );

      Serial.println(
        texto
      );

      return;
    }


    // ==================================================
    // RESULTADO REAL DE LA CAMARA
    // ==================================================

    Serial.print(
      "Tú: "
    );

    Serial.println(
      texto
    );


    // ==================================================
    // ENVIAR A LIA
    // ==================================================

    enviarResultadoALIA(
      texto
    );


    // ==================================================
    // REPRODUCIR AUDIO
    // ==================================================

    if (AUDIO_ACTIVO) {

      tts.hablar(
        texto
      );
    }
  }


  delay(10);
}
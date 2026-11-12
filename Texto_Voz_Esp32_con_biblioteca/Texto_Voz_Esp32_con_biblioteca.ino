#include <Arduino.h>
#include "TTSHelper.h"
#include <WiFi.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "secrets.h"

// ======================================================
// PINES I2S - PARLANTE
// ======================================================

#define I2S_DOUT 25
#define I2S_BCLK 27
#define I2S_LRC  32

// ======================================================
// WIFI
// ======================================================

const char* ssid = "Angie";
const char* password = "abaunza1";

// ======================================================
// TTS
// ======================================================

TTSHelper tts(
  I2S_BCLK,
  I2S_LRC,
  I2S_DOUT
);

// ======================================================
// MARCADORES ENVIADOS POR LA ESP32-CAM
// ======================================================

const char* RESULTADO_INICIO =
  "LIA_RESULT_BEGIN";

const char* RESULTADO_FIN =
  "LIA_RESULT_END";

// ======================================================
// ESTADO DE RECEPCIÓN
// ======================================================

bool recibiendoResultado = false;

String resultadoCamara = "";

// ======================================================
// URL BACKEND
// ======================================================

static String urlResultadoLIA() {

  String base =
    String(LIA_BACKEND_URL);

  base.trim();

  while (
    base.endsWith("/")
  ) {

    base.remove(
      base.length() - 1
    );
  }

  if (
    base.length() == 0
  ) {

    return "";
  }

  return
    base +
    "/api/camera/device-result";
}

// ======================================================
// LIMPIAR TEXTO PARA HABLAR
// ======================================================

String limpiarTextoParaVoz(
  String texto
) {

  texto.replace(
    "**",
    ""
  );

  texto.replace(
    "__",
    ""
  );

  texto.trim();

  return texto;
}

// ======================================================
// ENVIAR RESULTADO AL BACKEND
// ======================================================

bool enviarResultadoALIA(
  const String& texto
) {

  if (
    WiFi.status() !=
    WL_CONNECTED
  ) {

    Serial.println(
      "LIA: WiFi no conectado."
    );

    return false;
  }

  String url =
    urlResultadoLIA();

  if (
    url.length() == 0
  ) {

    Serial.println(
      "LIA: URL del backend vacía."
    );

    return false;
  }

  // ----------------------------------------------------
  // JSON
  // ----------------------------------------------------

  StaticJsonDocument<2048> doc;

  doc["deviceId"] =
    LIA_DEVICE_ID;

  doc["text"] =
    texto;

  String payload;

  if (
    serializeJson(
      doc,
      payload
    ) == 0
    ||
    payload.length() == 0
  ) {

    Serial.println(
      "LIA: no se pudo crear JSON."
    );

    return false;
  }

  Serial.println();
  Serial.println(
    "======================================"
  );

  Serial.println(
    "LIA: enviando resultado al backend..."
  );

  Serial.print(
    "LIA: URL = "
  );

  Serial.println(
    url
  );

  Serial.print(
    "LIA: payload = "
  );

  Serial.println(
    payload
  );

  Serial.println(
    "======================================"
  );

  // ----------------------------------------------------
  // HTTP
  // ----------------------------------------------------

  WiFiClient client;

  HTTPClient http;

  http.setTimeout(
    5000
  );

  if (
    !http.begin(
      client,
      url
    )
  ) {

    Serial.println(
      "LIA: no se pudo iniciar HTTP."
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

  // ----------------------------------------------------
  // POST
  // ----------------------------------------------------

  int code =
    http.POST(
      payload
    );

  Serial.print(
    "LIA: codigo HTTP = "
  );

  Serial.println(
    code
  );

  if (
    code > 0
  ) {

    String respuesta =
      http.getString();

    Serial.print(
      "LIA: respuesta = "
    );

    Serial.println(
      respuesta
    );

  } else {

    Serial.print(
      "LIA: error = "
    );

    Serial.println(
      http.errorToString(
        code
      )
    );
  }

  http.end();

  if (
    code == 200
  ) {

    Serial.println(
      "LIA: resultado enviado correctamente."
    );

    return true;
  }

  Serial.println(
    "LIA: error enviando resultado."
  );

  return false;
}

// ======================================================
// PROCESAR RESULTADO DE LA CAMARA
// ======================================================

void procesarResultadoCamara(
  String texto
) {

  texto.trim();

  if (
    texto.length() == 0
  ) {

    return;
  }

  // ----------------------------------------------------
  // INICIO DEL RESULTADO
  // ----------------------------------------------------

  if (
    texto == RESULTADO_INICIO
  ) {

    recibiendoResultado =
      true;

    resultadoCamara =
      "";

    Serial.println();
    Serial.println(
      "======================================"
    );

    Serial.println(
      "LIA: resultado de cámara recibido."
    );

    Serial.println(
      "LIA: esperando texto..."
    );

    return;
  }

  // ----------------------------------------------------
  // FIN DEL RESULTADO
  // ----------------------------------------------------

  if (
    texto == RESULTADO_FIN
  ) {

    if (
      !recibiendoResultado
    ) {

      return;
    }

    recibiendoResultado =
      false;

    resultadoCamara.trim();

    Serial.println();
    Serial.println(
      "======================================"
    );

    Serial.println(
      "RESULTADO DE LA ESP32-CAM:"
    );

    Serial.println(
      resultadoCamara
    );

    Serial.println(
      "======================================"
    );

    if (
      resultadoCamara.length() == 0
    ) {

      Serial.println(
        "LIA: resultado vacío."
      );

      resultadoCamara =
        "";

      return;
    }

    // --------------------------------------------------
    // ENVIAR AL BACKEND
    // --------------------------------------------------

    enviarResultadoALIA(
      resultadoCamara
    );

    // --------------------------------------------------
    // HABLAR
    // --------------------------------------------------

    String textoVoz =
      limpiarTextoParaVoz(
        resultadoCamara
      );

    Serial.println();
    Serial.println(
      "LIA: reproduciendo resultado..."
    );

    tts.hablar(
      textoVoz
    );

    resultadoCamara =
      "";

    Serial.println(
      "LIA: listo."
    );

    return;
  }

  // ----------------------------------------------------
  // ESTAMOS DENTRO DEL RESULTADO
  // ----------------------------------------------------

  if (
    recibiendoResultado
  ) {

    if (
      resultadoCamara.length() > 0
    ) {

      resultadoCamara +=
        " ";
    }

    resultadoCamara +=
      texto;

    return;
  }
}

// ======================================================
// SETUP
// ======================================================

void setup() {

  Serial.begin(
    115200
  );

  delay(
    3000
  );

  Serial.setTimeout(
    1000
  );

  Serial.println();
  Serial.println(
    "======================================"
  );

  Serial.println(
    "LIA - ESP32 PARLANTE"
  );

  Serial.println(
    "Esperando resultado de ESP32-CAM..."
  );

  Serial.println(
    "======================================"
  );

  // ----------------------------------------------------
  // WIFI
  // ----------------------------------------------------

  tts.conectarWiFi(
    ssid,
    password
  );

  // ----------------------------------------------------
  // MENSAJE DE INICIO
  // ----------------------------------------------------

  tts.hablar(
    "Conectado"
  );

  Serial.println();
  Serial.println(
    "======================================"
  );

  Serial.println(
    "ESP32 PARLANTE LISTA."
  );

  Serial.println(
    "Esperando resultado de la cámara..."
  );

  Serial.println(
    "======================================"
  );
}

// ======================================================
// LOOP
// ======================================================

void loop() {

  // ----------------------------------------------------
  // MANTENER AUDIO
  // ----------------------------------------------------

  tts.actualizarAudio();

  // ----------------------------------------------------
  // LEER DATOS DE LA ESP32-CAM
  // ----------------------------------------------------

  while (
    Serial.available()
  ) {

    String linea =
      Serial.readStringUntil(
        '\n'
      );

    linea.trim();

    if (
      linea.length() > 0
    ) {

      procesarResultadoCamara(
        linea
      );
    }
  }
}
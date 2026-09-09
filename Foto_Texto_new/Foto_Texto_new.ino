#include <WiFi.h>
#include <WiFiClientSecure.h>
#include "Base64.h"
#include <ArduinoJson.h>
#include "esp_camera.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "secrets.h"

// ======================================================
// VARIABLES Y CONFIGURACIONES GLOBALES
// ======================================================

const char* wifi_ssid = WIFI_SSID;
const char* wifi_pass = WIFI_PASSWORD;
String gemini_Key = GOOGLE_API_KEY;

const char* Gemini_Max_Tokens = "500";

String gemini_Chat =
  "Identifica el medicamento que aparece en la imagen y dime su nombre. "
  "Luego explica brevemente para que se usa normalmente, usando palabras muy sencillas "
  "que pueda entender una persona sin conocimientos de medicina. "
  "Responde en maximo 3 oraciones. "
  "Si el nombre del medicamento no se ve claramente, di que no puedes identificarlo con seguridad. "
  "No inventes informacion ni indiques dosis.";


// ======================================================
// PINES ESP32-CAM AI THINKER
// ======================================================

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

#define BUTTON_PIN        14
#define FLASH_PIN          4


// ======================================================
// DECLARACION DE FUNCIONES
// ======================================================

void initWiFi();

String SendStillToGeminiVision(
  String key,
  String message
);

String leerRespuestaHTTP(
  WiFiClientSecure &client
);

String escaparJSON(
  String texto
);


// ======================================================
// SETUP
// ======================================================

void setup() {

  // ====================================================
  // SERIAL PARA DIAGNOSTICAR WIFI
  // ====================================================

  Serial.begin(115200);

  delay(1000);


  // ====================================================
  // WIFI
  // ====================================================

  initWiFi();

  // Intentar mantener la conexión de la ESP32-CAM
  WiFi.setAutoReconnect(true);

  // Evita que el Wi-Fi entre en modo de ahorro de energía
  WiFi.setSleep(false);

  delay(1000);


  // Cerramos temporalmente Serial.
  // Después se vuelve a abrir únicamente para enviar
  // "Dispositivo listo" o el resultado de Gemini
  // a la segunda ESP32.
  Serial.end();


  // ====================================================
  // BOTON
  // ====================================================

  pinMode(
    BUTTON_PIN,
    INPUT_PULLUP
  );


  // ====================================================
  // CAMARA
  // ====================================================

  WRITE_PERI_REG(
    RTC_CNTL_BROWN_OUT_REG,
    0
  );


  camera_config_t config;


  config.ledc_channel =
    LEDC_CHANNEL_0;

  config.ledc_timer =
    LEDC_TIMER_0;


  config.pin_d0 =
    Y2_GPIO_NUM;

  config.pin_d1 =
    Y3_GPIO_NUM;

  config.pin_d2 =
    Y4_GPIO_NUM;

  config.pin_d3 =
    Y5_GPIO_NUM;

  config.pin_d4 =
    Y6_GPIO_NUM;

  config.pin_d5 =
    Y7_GPIO_NUM;

  config.pin_d6 =
    Y8_GPIO_NUM;

  config.pin_d7 =
    Y9_GPIO_NUM;


  config.pin_xclk =
    XCLK_GPIO_NUM;

  config.pin_pclk =
    PCLK_GPIO_NUM;

  config.pin_vsync =
    VSYNC_GPIO_NUM;

  config.pin_href =
    HREF_GPIO_NUM;


  config.pin_sscb_sda =
    SIOD_GPIO_NUM;

  config.pin_sscb_scl =
    SIOC_GPIO_NUM;


  config.pin_pwdn =
    PWDN_GPIO_NUM;

  config.pin_reset =
    RESET_GPIO_NUM;


  config.xclk_freq_hz =
    20000000;

  config.pixel_format =
    PIXFORMAT_JPEG;

  config.grab_mode =
    CAMERA_GRAB_LATEST;


  // ====================================================
  // PSRAM
  // ====================================================

  if (psramFound()) {

    config.frame_size =
      FRAMESIZE_UXGA;

    config.jpeg_quality =
      10;

    config.fb_count =
      1;

  } else {

    config.frame_size =
      FRAMESIZE_SVGA;

    config.jpeg_quality =
      12;

    config.fb_count =
      1;
  }


  // ====================================================
  // INICIAR CAMARA
  // ====================================================

  esp_err_t err =
    esp_camera_init(
      &config
    );


  if (err != ESP_OK) {

    delay(2000);

    ESP.restart();
  }


  sensor_t *s =
    esp_camera_sensor_get();


  if (
    s->id.PID ==
    OV3660_PID
  ) {

    s->set_vflip(
      s,
      1
    );

    s->set_brightness(
      s,
      1
    );

    s->set_saturation(
      s,
      -2
    );
  }


  s->set_framesize(
    s,
    FRAMESIZE_CIF
  );


  // ====================================================
  // FLASH
  // ====================================================

  pinMode(
    FLASH_PIN,
    OUTPUT
  );


  // ====================================================
  // PRUEBA INICIAL
  // ====================================================

  delay(2000);

  digitalWrite(
    FLASH_PIN,
    HIGH
  );


  String response =
    "Dispositivo listo";


  Serial.begin(
    115200
  );

  delay(500);

  Serial.println(
    response
  );

  delay(500);

  Serial.end();


  digitalWrite(
    FLASH_PIN,
    LOW
  );

  delay(2000);
}


// ======================================================
// LOOP
// ======================================================

void loop() {

  int buttonState =
    digitalRead(
      BUTTON_PIN
    );


  if (
    buttonState ==
    LOW
  ) {

    digitalWrite(
      FLASH_PIN,
      HIGH
    );


    String response =
      SendStillToGeminiVision(
        gemini_Key,
        gemini_Chat
      );


    // ==================================================
    // ENVIAR RESULTADO A LA SEGUNDA ESP32
    // ==================================================

    Serial.begin(
      115200
    );

    delay(500);

    Serial.println(
      response
    );

    delay(500);

    Serial.end();


    digitalWrite(
      FLASH_PIN,
      LOW
    );

  } else {

    digitalWrite(
      FLASH_PIN,
      LOW
    );
  }


  delay(50);
}


// ======================================================
// WIFI
// ======================================================

void initWiFi() {

  Serial.println();

  Serial.print(
    "Conectando a WiFi: "
  );

  Serial.println(
    wifi_ssid
  );


  WiFi.mode(
    WIFI_STA
  );


  WiFi.begin(
    wifi_ssid,
    wifi_pass
  );


  long inicio =
    millis();


  while (
    WiFi.status() !=
    WL_CONNECTED
  ) {

    delay(500);

    Serial.print(".");


    if (
      millis() - inicio >
      15000
    ) {

      Serial.println(
        "\nNo se pudo conectar al WiFi."
      );

      return;
    }
  }


  Serial.println(
    "\nWiFi conectado."
  );


  Serial.print(
    "Direccion IP: "
  );


  Serial.println(
    WiFi.localIP()
  );


  Serial.println();
}


// ======================================================
// ESCAPAR TEXTO PARA JSON
// ======================================================

String escaparJSON(
  String texto
) {

  String resultado =
    "";


  resultado.reserve(
    texto.length() + 10
  );


  for (
    size_t i = 0;
    i < texto.length();
    i++
  ) {

    char c =
      texto[i];


    if (
      c == '\\'
    ) {

      resultado +=
        "\\\\";

    } else if (
      c == '"'
    ) {

      resultado +=
        "\\\"";

    } else if (
      c == '\n'
    ) {

      resultado +=
        "\\n";

    } else if (
      c == '\r'
    ) {

      resultado +=
        "\\r";

    } else {

      resultado +=
        c;
    }
  }


  return resultado;
}


// ======================================================
// LEER RESPUESTA HTTP
// ======================================================

String leerRespuestaHTTP(
  WiFiClientSecure &client
) {

  String body =
    "";


  client.setTimeout(
    15000
  );


  String statusLine =
    client.readStringUntil(
      '\n'
    );


  statusLine.trim();


  Serial.print(
    "Estado HTTP: "
  );

  Serial.println(
    statusLine
  );


  int contentLength =
    -1;

  bool chunked =
    false;


  // ====================================================
  // HEADERS
  // ====================================================

  while (
    client.connected()
  ) {

    String line =
      client.readStringUntil(
        '\n'
      );


    line.trim();


    if (
      line.length() ==
      0
    ) {

      break;
    }


    if (
      line.startsWith(
        "Content-Length:"
      )
    ) {

      String valor =
        line.substring(
          String(
            "Content-Length:"
          ).length()
        );


      valor.trim();


      contentLength =
        valor.toInt();
    }


    String lowerLine =
      line;


    lowerLine.toLowerCase();


    if (
      lowerLine.startsWith(
        "transfer-encoding:"
      )
      &&
      lowerLine.indexOf(
        "chunked"
      ) >= 0
    ) {

      chunked =
        true;
    }
  }


  // ====================================================
  // RESPUESTA CHUNKED
  // ====================================================

  if (chunked) {

    Serial.println(
      "Respuesta HTTP por bloques."
    );


    while (true) {

      String sizeLine =
        client.readStringUntil(
          '\n'
        );


      sizeLine.trim();


      if (
        sizeLine.length() ==
        0
      ) {

        continue;
      }


      int puntoComa =
        sizeLine.indexOf(
          ';'
        );


      if (
        puntoComa >= 0
      ) {

        sizeLine =
          sizeLine.substring(
            0,
            puntoComa
          );
      }


      int chunkSize =
        strtol(
          sizeLine.c_str(),
          NULL,
          16
        );


      if (
        chunkSize <= 0
      ) {

        break;
      }


      int recibidos =
        0;


      while (
        recibidos <
        chunkSize
      ) {

        if (
          client.available()
        ) {

          body +=
            (char)client.read();

          recibidos++;

        } else {

          delay(1);
        }
      }


      client.read();
      client.read();
    }
  }


  // ====================================================
  // CONTENT LENGTH
  // ====================================================

  else if (
    contentLength >= 0
  ) {

    Serial.print(
      "Content-Length: "
    );

    Serial.println(
      contentLength
    );


    body.reserve(
      contentLength + 1
    );


    int recibidos =
      0;


    unsigned long ultimoDato =
      millis();


    while (
      recibidos <
      contentLength
      &&
      millis() - ultimoDato <
      15000
    ) {

      while (
        client.available()
        &&
        recibidos <
        contentLength
      ) {

        body +=
          (char)client.read();

        recibidos++;

        ultimoDato =
          millis();
      }


      delay(1);
    }
  }


  // ====================================================
  // SIN CONTENT LENGTH
  // ====================================================

  else {

    Serial.println(
      "Respuesta sin Content-Length."
    );


    unsigned long ultimoDato =
      millis();


    while (
      client.connected()
      ||
      client.available()
    ) {

      while (
        client.available()
      ) {

        body +=
          (char)client.read();

        ultimoDato =
          millis();
      }


      if (
        millis() - ultimoDato >
        15000
      ) {

        break;
      }


      delay(1);
    }
  }


  return body;
}


// ======================================================
// CAPTURA Y ENVIO A GEMINI
// ======================================================

String SendStillToGeminiVision(
  String key,
  String message
) {

  // ====================================================
  // COMPROBAR WIFI
  // ====================================================

  if (
    WiFi.status() !=
    WL_CONNECTED
  ) {

    Serial.begin(
      115200
    );

    delay(100);


    Serial.println(
      "WiFi desconectado. Reconectando..."
    );


    initWiFi();


    if (
      WiFi.status() !=
      WL_CONNECTED
    ) {

      Serial.end();

      return
        "No hay conexion WiFi.";
    }


    Serial.end();
  }


  // ====================================================
  // CLIENTE SEGURO
  // ====================================================

  WiFiClientSecure client_tcp;


  client_tcp.setInsecure();

  client_tcp.setTimeout(
    15000
  );


  const char* myDomain =
    "generativelanguage.googleapis.com";


  // ====================================================
  // CONECTAR CON GEMINI
  // ====================================================

  if (
    !client_tcp.connect(
      myDomain,
      443
    )
  ) {

    return
      "Error al conectar con Gemini.";
  }


  // ====================================================
  // DESCARTAR FRAME ANTERIOR
  // ====================================================

  camera_fb_t *fb =
    esp_camera_fb_get();


  if (
    fb != NULL
  ) {

    esp_camera_fb_return(
      fb
    );
  }


  fb =
    NULL;


  delay(100);


  // ====================================================
  // CAPTURAR FOTO NUEVA
  // ====================================================

  fb =
    esp_camera_fb_get();


  if (!fb) {

    client_tcp.stop();

    return
      "Error al capturar imagen.";
  }


  // ====================================================
  // LONGITUD BASE64
  // ====================================================

  size_t base64_len =
    base64_enc_len(
      fb->len
    );


  // ====================================================
  // JSON PARA GEMINI
  // ====================================================

  String mensajeSeguro =
    escaparJSON(
      message
    );


  String jsonStart =
    "{"
      "\"contents\":["
        "{"
          "\"parts\":["
            "{"
              "\"text\":\"" + mensajeSeguro + "\""
            "},"
            "{"
              "\"inline_data\":{"
                "\"mime_type\":\"image/jpeg\","
                "\"data\":\"";


  String jsonEnd =
              "\""
              "}"
            "}"
          "]"
        "}"
      "],"
      "\"generationConfig\":{"
        "\"maxOutputTokens\":" + String(Gemini_Max_Tokens) + ","
        "\"thinkingConfig\":{"
          "\"thinkingLevel\":\"low\""
        "}"
      "}"
    "}";


  size_t totalContentLength =
    jsonStart.length()
    +
    base64_len
    +
    jsonEnd.length();


  // ====================================================
  // SOLICITUD HTTP
  // ====================================================

  client_tcp.println(
    "POST /v1beta/models/gemini-3.6-flash:generateContent HTTP/1.1"
  );


  client_tcp.println(
    "Host: generativelanguage.googleapis.com"
  );


  client_tcp.println(
    "x-goog-api-key: " + key
  );


  client_tcp.println(
    "Content-Type: application/json"
  );


  client_tcp.println(
    "Content-Length: "
    +
    String(
      totalContentLength
    )
  );


  client_tcp.println(
    "Connection: close"
  );


  client_tcp.println();


  // ====================================================
  // ENVIO DE DATOS EN BLOQUES
  // ====================================================

  client_tcp.print(
    jsonStart
  );


  char output[
    base64_enc_len(3) + 1
  ];


  uint8_t *src =
    fb->buf;


  size_t len =
    fb->len;


  while (
    len >= 3
  ) {

    int encodedLength =
      base64_encode(
        output,
        (char *)src,
        3
      );


    client_tcp.write(
      (uint8_t *)output,
      encodedLength
    );


    src += 3;

    len -= 3;
  }


  if (
    len > 0
  ) {

    int encodedLength =
      base64_encode(
        output,
        (char *)src,
        len
      );


    client_tcp.write(
      (uint8_t *)output,
      encodedLength
    );
  }


  client_tcp.print(
    jsonEnd
  );


  esp_camera_fb_return(
    fb
  );


  // ====================================================
  // LEER RESPUESTA
  // ====================================================

  String responseBody =
    leerRespuestaHTTP(
      client_tcp
    );


  client_tcp.stop();


  if (
    responseBody.length() ==
    0
  ) {

    return
      "Gemini devolvio una respuesta vacia.";
  }


  // ====================================================
  // PARSEAR JSON
  // ====================================================

  JsonDocument doc;


  DeserializationError error =
    deserializeJson(
      doc,
      responseBody
    );


  if (error) {

    return
      "Error al interpretar respuesta JSON: "
      +
      String(
        error.c_str()
      );
  }


  // ====================================================
  // ERROR API
  // ====================================================

  if (
    !doc["error"]["message"].isNull()
  ) {

    String errorAPI =
      doc["error"]["message"]
        .as<String>();


    return
      "Error de API: "
      +
      errorAPI;
  }


  // ====================================================
  // EXTRAER RESPUESTA
  // ====================================================

  JsonArray candidates =
    doc["candidates"]
      .as<JsonArray>();


  if (
    candidates.isNull()
    ||
    candidates.size() ==
    0
  ) {

    return
      "Gemini no devolvio candidatos.";
  }


  JsonArray parts =
    candidates[0]["content"]["parts"]
      .as<JsonArray>();


  if (
    parts.isNull()
    ||
    parts.size() ==
    0
  ) {

    return
      "Gemini respondio pero no devolvio texto.";
  }


  String respuestaFinal =
    "";


  for (
    JsonObject part : parts
  ) {

    if (
      !part["text"].isNull()
    ) {

      String texto =
        part["text"]
          .as<String>();


      if (
        texto.length() >
        0
      ) {

        if (
          respuestaFinal.length() >
          0
        ) {

          respuestaFinal +=
            " ";
        }


        respuestaFinal +=
          texto;
      }
    }
  }


  respuestaFinal.trim();


  if (
    respuestaFinal.length() ==
    0
  ) {

    return
      "Gemini respondio pero no encontre texto.";
  }


  return respuestaFinal;
}
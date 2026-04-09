/******************************************************************************
 * File        : src.ino
 * Description : Rotary Encoder Angle Reader (Sin/Cos) with Dual Core Support
 * Target      : ESP32-S3-DEV-KIT-N16R8-M
 * Date        : 2025/XX/XX
 * License     : MinebeaMitsumi Inc.
 ******************************************************************************/

#include <Arduino.h>
#include <LittleFS.h>
#include <float.h>
/* local */
#include <IPS_Cfg.h>
#include <IPS.h>
#include <IPS_Debug.h>
#include <IPS_Wifi.h>

//==============================================================================
// Define
//==============================================================================
#define STATIC_FILE_PATH_COUNT    (sizeof(gStaticFile) / sizeof(gStaticFile[0]))
#define STATIC_DIR_PATH_COUNT     (sizeof(gStaticDir) / sizeof(gStaticDir[0]))

//==============================================================================
// Struct
//==============================================================================
/* [Reserved] */

//==============================================================================
// Variable
//==============================================================================

/* 排他制御用ミューテックス */
SemaphoreHandle_t xSensorDataMutex = NULL;

/* IPS Data (Core 0 ローカル変数) */
Sensor sensors[IPS_NUM_SENSORS];
float currentAngle = 0.0f;

/* IPS Data (Core 0/1 共有バッファ - Mutex保護対象) */
Sensor shared_sensors[IPS_NUM_SENSORS];
float shared_angle = 0.0f;

/* 信号処理用変数 (cos) */
int cos_val = 0;
int cos_max = INT_MIN;
int cos_min = INT_MAX;
float cos_off = 0;
float cos_amp = 1.0;
float cos_nor = 0;

/* 信号処理用変数 (sin) */
int sin_val = 0;
int sin_max = INT_MIN;
int sin_min = INT_MAX;
float sin_off = 0;
float sin_amp = 1.0;
float sin_nor = 0;

/* タイミング管理 */
unsigned long lastSensorSendTime = 0U;
const unsigned long sensorInterval = IPS_CFG_WIFI_TX_INTERVAL;

/* Wi-Fi・Server設定 */
const char* ssid = IPS_WIFI_SSID;
const char* password = IPS_WIFI_PASSWORD;

/* GPIOピン定義 */
const int gpio_pins[] = 
{
  IPS_CFG_PORT_GPIO_COS,
  IPS_CFG_PORT_GPIO_SIN,
  IPS_CFG_PORT_GPIO_COSN,
  IPS_CFG_PORT_GPIO_SINN
};

/* 静的ファイルパス定義 */
const char* gStaticFile[] = 
{
  /* HTML */
  "/index.html",
  "/offline.html",
  /* CSS */
  "/css/style.css",
  /* JavaScript */
  "/js/log.js",
  "/js/ui-control.js",
  "/js/resize.js",
  "/js/graph.js",
  "/js/calibration.js",
  //"/js/serial.js",
  //"/js/serial_mock.js",
  "/js/websocket.js",
  //"/js/websocket_mock.js",
  "/js/init.js",
  "/service-worker.js",
  "/register-sw.js",
  /* manifest */
  "/manifest.json"
};

const char* gStaticDir[] = 
{
  "/img"
};

/* サーバーインスタンス */
WebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(81);

//==============================================================================
// Task Handles
//==============================================================================
TaskHandle_t TaskSensorHandle;

//==============================================================================
// API Declaration
//==============================================================================
void Esp_Init();
void Wifi_init();
void Wifi_HandleNetworkEvent();
void Wifi_SendData(Sensor sensors[], float angle);
void onWebSocketEvent(uint8_t client_num, WStype_t type, uint8_t* payload, size_t length);

static void ips_setting();
static void ips_Calibration();
static int  ips_AnalogReadAverage(int pin);
static void ips_AngleCalculation();
static void server_SetupStaticFiles();
static void server_SetupWebServer();
void TaskSensor(void *pvParameters);

//==============================================================================
// Setup
//==============================================================================
void setup() 
{
  Serial.begin(IPS_CFG_SERIAL_BAUDRATE);
  
  /* データ共有用ミューテックス作成 */
  xSensorDataMutex = xSemaphoreCreateMutex();
  if (xSensorDataMutex != NULL) {
    xSemaphoreGive(xSensorDataMutex);
  }

  Esp_Init();
  Wifi_init();

  /* Core 0でセンサータスクを起動 */
  /* Stack: 4096, Priority: 1, Core: 0 */
  xTaskCreatePinnedToCore(
    TaskSensor,
    "TaskSensor",
    4096,
    NULL,
    1,
    &TaskSensorHandle,
    0
  );
}

//==============================================================================
// Loop (Runs on Core 1)
//==============================================================================
void loop() 
{
  unsigned long now = millis();

  /* Wi-Fi / HTTP / WebSocket処理 */
  Wifi_HandleNetworkEvent();

  /* 定期的なデータ送信処理 */
  if (now - lastSensorSendTime >= sensorInterval) 
  {
    lastSensorSendTime = now;

    /* Core 0から最新データを取得するためのローカル変数 */
    Sensor local_sensors[IPS_NUM_SENSORS];
    float local_angle = 0.0f;
    bool dataReady = false;

    /* ミューテックスを取得して共有データをコピー */
    if (xSemaphoreTake(xSensorDataMutex, (TickType_t)10) == pdTRUE) {
      memcpy(local_sensors, shared_sensors, sizeof(shared_sensors));
      local_angle = shared_angle;
      xSemaphoreGive(xSensorDataMutex);
      dataReady = true;
    }

    /* データ取得に成功していれば送信 */
    if (dataReady) {
      Wifi_SendData(local_sensors, local_angle);
    }
  }
}

//==============================================================================
// Task: Sensor (Runs on Core 0)
//==============================================================================
void TaskSensor(void *pvParameters)
{
  LOG_INFO("TaskSensor started on Core %d", xPortGetCoreID());

  /* タスク周期管理用 (10ms) */
  TickType_t xLastWakeTime;
  const TickType_t xFrequency = pdMS_TO_TICKS(10);
  xLastWakeTime = xTaskGetTickCount();

  for (;;)
  {
    /* センサー読み取り & キャリブレーション */
    ips_Calibration();
    
    /* 角度計算 */
    ips_AngleCalculation();
    
    /* 計算結果を共有領域へ書き込み（排他制御） */
    if (xSemaphoreTake(xSensorDataMutex, (TickType_t)10) == pdTRUE) {
      memcpy(shared_sensors, sensors, sizeof(sensors));
      shared_angle = currentAngle;
      xSemaphoreGive(xSensorDataMutex);
    }
    
    /* 次の周期まで待機 (絶対時間待機) */
    vTaskDelayUntil(&xLastWakeTime, xFrequency);
  }
}

//==============================================================================
// ESP / IPS Functions
//==============================================================================
/* ESP初期化 */
void Esp_Init()
{
  ips_setting();
  LOG_INFO("ESP initialized");
}

/* IPS(センサー)関連の初期化 */
void ips_setting()
{
  /* 起動待機 */
  delay(IPS_CFG_ESP_STARTUP_DELAY);

  /* ポート設定 */
  for (int idx = 0; idx < IPS_NUM_SENSORS; idx++)
  {
    pinMode(gpio_pins[idx], INPUT);
    sensors[idx].pin = gpio_pins[idx];
    sensors[idx].val = IPS_CFG_ADC_MIN_VALUE;
    sensors[idx].max = IPS_CFG_ADC_MIN_VALUE;
    sensors[idx].min = IPS_CFG_ADC_MAX_VALUE;
  }

#if (IPS_DEBUG == 0U)
  esp_log_level_set("*", ESP_LOG_NONE);
#endif 

  /* ADC設定 */
  analogReadResolution(IPS_CFG_ADC_BITS);
  analogSetAttenuation(IPS_CFG_ADC_INPUT_V_RANGE);
  
  LOG_INFO("IPS Init");
}

/* センサー読み取りとキャリブレーション値の更新 */
static void ips_Calibration()
{
  for (int idx = 0U; idx < IPS_NUM_SENSORS; idx++)
  {
    sensors[idx].val = ips_AnalogReadAverage(sensors[idx].pin);
    sensors[idx].max = max(sensors[idx].max, sensors[idx].val);
    sensors[idx].min = min(sensors[idx].min, sensors[idx].val);
  }
}

/* アナログ値の平均化読み取り */
static int ips_AnalogReadAverage(int pin)
{
  long sum = 0U;
  for (int idx = 0U; idx < IPS_ANALOG_NUM_READ_SAMPLE; idx++) 
  {
    sum += analogRead(pin);
  }
  return (int)(sum / IPS_ANALOG_NUM_READ_SAMPLE);
}

/* 角度算出処理 */
static void ips_AngleCalculation() 
{
  /* sin成分の正規化 */
  int mid   = (sensors[IPS_IDX_SIN_DATA].max + sensors[IPS_IDX_SIN_DATA].min) / 2U;
  int mid_n = (sensors[IPS_IDX_SINN_DATA].max + sensors[IPS_IDX_SINN_DATA].min) / 2U;
  
  sin_val = ((sensors[IPS_IDX_SIN_DATA].val - mid) - (sensors[IPS_IDX_SINN_DATA].val - mid_n));
  sin_max = max(sin_max, sin_val);
  sin_min = min(sin_min, sin_val);
  sin_off = (sin_max + sin_min) / 2.0f;
  sin_amp = (sin_max - sin_min) / 2.0f;
  if (fabs(sin_amp) < 1.0) sin_amp = 1.0;
  sin_nor = (sin_val - sin_off) / sin_amp;

  /* cos成分の正規化 */
  mid   = (sensors[IPS_IDX_COS_DATA].max + sensors[IPS_IDX_COS_DATA].min) / 2U;
  mid_n = (sensors[IPS_IDX_COSN_DATA].max + sensors[IPS_IDX_COSN_DATA].min) / 2U;
  
  cos_val = ((sensors[IPS_IDX_COS_DATA].val - mid) - (sensors[IPS_IDX_COSN_DATA].val - mid_n));
  cos_max = max(cos_max, cos_val);
  cos_min = min(cos_min, cos_val);
  cos_off = (cos_max + cos_min) / 2.0f;
  cos_amp = (cos_max - cos_min) / 2.0f;
  if (fabs(cos_amp) < 1.0) cos_amp = 1.0;
  cos_nor = (cos_val - cos_off) / cos_amp;

  /* アークタンジェントによる角度算出 */
  float angle_rad = atan2f(sin_nor, cos_nor);
  float angle_deg = angle_rad * (180.0f / PI);
  if (angle_deg < 0)
  {
    angle_deg += 360.0;
  }
  currentAngle = angle_deg;

  LOG_INFO("cos_nor: %.3f, sin_nor: %.3f, angle_deg: %.2f", cos_nor, sin_nor, angle_deg);
}

//==============================================================================
// WebSocket / Wi-Fi / DNS
//==============================================================================

/* Wi-Fiおよびサーバー機能の初期化 */
void Wifi_init() 
{
  /* SoftAP開始 */
  if (!WiFi.softAP(ssid, password)) 
  {
    LOG_ERROR("Failed to start SoftAP");
    return;
  }

  IPAddress apIP = WiFi.softAPIP();
  String ipStr = apIP.toString();
  LOG_INFO("SSID: %s", ssid);
  LOG_INFO("AP IP address: %s", ipStr.c_str());

  /* LittleFSマウント */
  if (!LittleFS.begin()) 
  {
    LOG_ERROR("LittleFS mount failed");
    return;
  }

  /* HTTPサーバー設定 */
  server_SetupStaticFiles();
  server_SetupWebServer();
  server.begin();
  LOG_INFO("HTTP server started");

  /* WebSocketサーバー設定 */
  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);
  LOG_INFO("WebSocket server started");
}

/* ネットワークイベントハンドラ */
void Wifi_HandleNetworkEvent() 
{
  server.handleClient();
  webSocket.loop();
}

/* データ送信 (WebSocket Broadcast) */
void Wifi_SendData(Sensor sensors[], float angle) 
{
  uint16_t A_val = sensors[IPS_IDX_SIN_DATA].val;
  uint16_t B_val = sensors[IPS_IDX_COS_DATA].val;
  uint16_t C_val = sensors[IPS_IDX_SINN_DATA].val;
  uint16_t D_val = sensors[IPS_IDX_COSN_DATA].val;
  
  uint8_t buffer[12];
  buffer[0] = (A_val >> 8) & 0xFF;
  buffer[1] = A_val & 0xFF;
  buffer[2] = (B_val >> 8) & 0xFF;
  buffer[3] = B_val & 0xFF;
  buffer[4] = (C_val >> 8) & 0xFF;
  buffer[5] = C_val & 0xFF;
  buffer[6] = (D_val >> 8) & 0xFF;
  buffer[7] = D_val & 0xFF;

  /* floatをバイト列に変換（リトルエンディアン） */
  uint8_t* angle_bytes = (uint8_t*)&angle;
  for (int idx = 0U; idx < 4U; idx++) 
  {
    buffer[8U + idx] = angle_bytes[idx];
  }
  webSocket.broadcastBIN(buffer, sizeof(buffer));
}

/* WebSocketイベントコールバック */
void onWebSocketEvent(uint8_t client_num, WStype_t type, uint8_t* payload, size_t length) 
{
  switch (type) 
  {
    case WStype_CONNECTED:
      LOG_INFO("Client [%u] connected", client_num);
      webSocket.sendTXT(client_num, "Welcome!");
      break;

    case WStype_DISCONNECTED:
      LOG_INFO("Client [%u] disconnected", client_num);
      break;
      
    default:
      break;
  }
}

/* 静的ファイルのルーティング設定 */
static void server_SetupStaticFiles() 
{
  /* ファイル単位の配信設定 */
  for (int idx = 0; idx < STATIC_FILE_PATH_COUNT; idx++) 
  {
    if (LittleFS.exists(gStaticFile[idx])) 
    {
      server.serveStatic(gStaticFile[idx], LittleFS, gStaticFile[idx]);
      LOG_INFO("Serving file: %s", gStaticFile[idx]);
    } 
    else 
    {
      LOG_ERROR("File not found: %s", gStaticFile[idx]);
    }
  }

  /* ディレクトリ単位の配信設定 */
  for (int idx = 0; idx < STATIC_DIR_PATH_COUNT; idx++) 
  {
    server.serveStatic(gStaticDir[idx], LittleFS, gStaticDir[idx]);
    LOG_INFO("Serving directory: %s", gStaticDir[idx]);
  }
}

/* Webサーバーのルーティング設定 */
static void server_SetupWebServer() 
{
  /* 404 Not Found */
  server.onNotFound([]() 
  {
    LOG_INFO("Request: 404 - Not Found");
    server.send(404, "text/plain", "Not Found");
  });

  /* トップページ ("/") へのアクセス */
  server.on("/", HTTP_GET, []() 
  {
    LOG_INFO("Request: Top page");
    File file = LittleFS.open("/index.html", "r");
    if (file) 
    {
      server.streamFile(file, "text/html");
      file.close();
    } 
    else 
    {
      server.send(500, "text/plain", "index.html not found");
      LOG_ERROR("HTTP 500 Error (Internal Server Error)");
    }
  });
}
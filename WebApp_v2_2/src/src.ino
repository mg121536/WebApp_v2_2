/******************************************************************************
 * File        : src.ino
 * Description : IPS Angle Calc (Core 0) + WebSocket Server (Core 1)
 * Target      : ESP32-S3-DEV-KIT-N16R8-M
 * Date        : 2026/XX/XX
 * License     : MinebeaMitsumi Inc.
 ******************************************************************************/

#include <Arduino.h>
#include <LittleFS.h>
#include <float.h>
#include <esp_adc/adc_continuous.h>
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


//==============================================================================
// Variable
//==============================================================================
// 1. System, RTOS & Hardware Handles
/* センサーデータへの同時アクセスを防ぐためのミューテックス */
SemaphoreHandle_t xSensorDataMutex = NULL;

/* ADCサンプリング・計算を行うメイン処理タスクのハンドル */
TaskHandle_t TaskSensorHandle;

/* DMA管理ハンドル */
adc_continuous_handle_t adc_handle = NULL;

/* サーバーインスタンス */
WebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(81);

// 2. Constants
/* Wi-Fi接続情報の定義 */
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
  /* CSS */
  "/css/style.css",
  /* JavaScript */
  "/js/log.js",
  "/js/ui-control.js",
  "/js/graph.js",
  "/js/calibration.js",
  "/js/websocket.js",
  //"/js/websocket_mock.js",
  "/js/init.js",
};

const char* gStaticDir[] = 
{
  "/img"
};

// 3. Shared & Global Variables
/* 送信待機データありフラグ */
volatile bool shared_batch_ready = false;

/* バッチ送信用の共有バッファ(Mutex保護対象) */
static SensorDataPoint shared_batch[IPS_SIZE_BATCH];

/* IPS Data (Core 0 グローバル変数) */
Sensor sensors[IPS_NUM_SENSORS];
float currentAngle = 0.0f;

/* 変換後のADCチャネル保持用 */
adc_channel_t ch_cos;
adc_channel_t ch_sin;
adc_channel_t ch_cosn;
adc_channel_t ch_sinn;

//==============================================================================
// API Declaration
//==============================================================================
static void ips_setting();
static void ips_AngleCalculation();
static void server_SetupStaticFiles();
static void server_SetupWebServer();

//==============================================================================
// (ISR)
//==============================================================================
/* DMA完了割り込みコールバック (ISR) */
static bool IRAM_ATTR adc_conv_done_cb(adc_continuous_handle_t handle, const adc_continuous_evt_data_t *edata, void *user_data) 
{
    BaseType_t mustYield = pdFALSE;
    /* DMA変換完了をTaskSensorへ通知（待機状態を解除） */
    vTaskNotifyGiveFromISR(TaskSensorHandle, &mustYield);
    return (mustYield == pdTRUE);
}

//==============================================================================
// Setup
//==============================================================================
void setup() 
{
  Serial.begin(IPS_CFG_SERIAL_BAUDRATE);
  
  /* データ共有用ミューテックス作成 */
  xSensorDataMutex = xSemaphoreCreateMutex();

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

  Esp_Init();
  Wifi_init();
}

//==============================================================================
// Loop (Runs on Core 1)
//==============================================================================
void loop() 
{
  bool send_batch = false;
  SensorDataPoint local_send_buffer[IPS_SIZE_BATCH];

  /* Wi-Fi / HTTP / WebSocket処理 */
  Wifi_HandleNetworkEvent();

  /* 排他制御下で共有バッファを確認し、新規データがあればローカルへ退避する */
  if (xSemaphoreTake(xSensorDataMutex, 0) == pdTRUE) {
    if (shared_batch_ready) {
      memcpy(local_send_buffer, shared_batch, sizeof(shared_batch));
      shared_batch_ready = false;
      send_batch = true;
    }
    xSemaphoreGive(xSensorDataMutex);
  }
  yield();

  /* データ取得に成功していれば送信 */
  if (send_batch) {
    Wifi_SendBatchData(local_send_buffer);
  }
}

//==============================================================================
// Task: Sensor (Runs on Core 0)
//==============================================================================
void TaskSensor(void *pvParameters)
{
  int batch_index = 0;
  uint8_t result[IPS_ADC_READ_LEN] = {0};
  uint32_t ret_num = 0;
  SensorDataPoint local_batch[IPS_SIZE_BATCH];

  for (;;)
  {
    /* ISRからのDMA完了通知を待機 (CPU負荷を抑えるためのブロック) */
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);

    /* DMAバッファから生データを取得 */
    esp_err_t ret = adc_continuous_read(adc_handle, result, IPS_ADC_READ_LEN, &ret_num, 0);
    
    if (ret == ESP_OK) {
      long sum_sin = 0, sum_cos = 0, sum_sinn = 0, sum_cosn = 0;
      int count_sin = 0, count_cos = 0, count_sinn = 0, count_cosn = 0;

      /* Type2フォーマット(4バイト/件)の解析とチャネル別集計 */
      for (int idx = 0; idx < ret_num; idx += SOC_ADC_DIGI_RESULT_BYTES) {
        adc_digi_output_data_t *p = (adc_digi_output_data_t*)&result[idx];
        uint32_t chan_num = p->type2.channel;
        uint32_t data = p->type2.data;

        if (chan_num == ch_sin) { sum_sin += data; count_sin++; }
        else if (chan_num == ch_cos) { sum_cos += data; count_cos++; }
        else if (chan_num == ch_sinn) { sum_sinn += data; count_sinn++; }
        else if (chan_num == ch_cosn) { sum_cosn += data; count_cosn++; }
      }

      /* 平均化したセンサー値をグローバル構造体へ格納 */
      if (count_sin > 0) sensors[IPS_IDX_SIN_DATA].val = sum_sin / count_sin;
      if (count_cos > 0) sensors[IPS_IDX_COS_DATA].val = sum_cos / count_cos;
      if (count_sinn > 0) sensors[IPS_IDX_SINN_DATA].val = sum_sinn / count_sinn;
      if (count_cosn > 0) sensors[IPS_IDX_COSN_DATA].val = sum_cosn / count_cosn;

      /* リアルタイムで最小値・最大値を更新し、キャリブレーションを更新する */
      for(int idx = 0; idx < IPS_NUM_SENSORS; idx++) {
         if (sensors[idx].val != IPS_CFG_ADC_MIN_VALUE) {
            sensors[idx].max = max(sensors[idx].max, sensors[idx].val);
            sensors[idx].min = min(sensors[idx].min, sensors[idx].val);
         }
      }

      /* 取得したセンサー値から角度(0-360°)を算出 */
      ips_AngleCalculation();
      
      /* 算出結果を通信用バッファへコピーし、バッチ送信準備を行う */
      local_batch[batch_index].A_Data = sensors[IPS_IDX_COS_DATA].val;
      local_batch[batch_index].B_Data = sensors[IPS_IDX_SIN_DATA].val;
      local_batch[batch_index].C_Data = sensors[IPS_IDX_COSN_DATA].val;
      local_batch[batch_index].D_Data = sensors[IPS_IDX_SINN_DATA].val;
      local_batch[batch_index].angle = currentAngle;
      batch_index++;

      /* 指定のバッチサイズに達したら、通信タスク(Core 1)が参照する共有領域へ転送 */
      if (batch_index >= IPS_SIZE_BATCH) {
        if (xSemaphoreTake(xSensorDataMutex, 1) == pdTRUE) {
          memcpy(shared_batch, local_batch, sizeof(local_batch));
          shared_batch_ready = true;
          xSemaphoreGive(xSensorDataMutex);
        }
        batch_index = 0;
      }
    }
  }
}

//==============================================================================
// ESP / IPS Functions
//==============================================================================
/* ESP初期化 */
void Esp_Init()
{
  ips_setting();
}

/* IPS(センサー)関連の初期化 */
void ips_setting()
{
  /* 起動待機 */
  delay(IPS_CFG_ESP_STARTUP_DELAY);

  /* センサー構造体の初期化 */
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

  /* GPIOピンからADCチャネル番号を取得 */
  ch_cos  = (adc_channel_t)digitalPinToAnalogChannel(IPS_CFG_PORT_GPIO_COS);
  ch_sin  = (adc_channel_t)digitalPinToAnalogChannel(IPS_CFG_PORT_GPIO_SIN);
  ch_cosn = (adc_channel_t)digitalPinToAnalogChannel(IPS_CFG_PORT_GPIO_COSN);
  ch_sinn = (adc_channel_t)digitalPinToAnalogChannel(IPS_CFG_PORT_GPIO_SINN);

  /* ADC DMAハンドラの作成 */
  adc_continuous_handle_cfg_t adc_config = {
      .max_store_buf_size = 1024,
      .conv_frame_size = IPS_ADC_READ_LEN,
  };
  ESP_ERROR_CHECK(adc_continuous_new_handle(&adc_config, &adc_handle));

  /* DMAサンプリングパターンの設定 */
  adc_digi_pattern_config_t adc_pattern[4] = {
      { .atten = ADC_ATTEN_DB_12, .channel = ch_cos,  .unit = ADC_UNIT_1, .bit_width = SOC_ADC_DIGI_MAX_BITWIDTH },
      { .atten = ADC_ATTEN_DB_12, .channel = ch_sin,  .unit = ADC_UNIT_1, .bit_width = SOC_ADC_DIGI_MAX_BITWIDTH },
      { .atten = ADC_ATTEN_DB_12, .channel = ch_cosn, .unit = ADC_UNIT_1, .bit_width = SOC_ADC_DIGI_MAX_BITWIDTH },
      { .atten = ADC_ATTEN_DB_12, .channel = ch_sinn, .unit = ADC_UNIT_1, .bit_width = SOC_ADC_DIGI_MAX_BITWIDTH }
  };

  adc_continuous_config_t dig_cfg = {
      .sample_freq_hz = 20000,
      .conv_mode = ADC_CONV_SINGLE_UNIT_1,
      .format = ADC_DIGI_OUTPUT_FORMAT_TYPE2,
  };
  dig_cfg.pattern_num = 4;
  dig_cfg.adc_pattern = adc_pattern;
  ESP_ERROR_CHECK(adc_continuous_config(adc_handle, &dig_cfg));

  /* DMA割り込みコールバックの登録と測定開始 */
  adc_continuous_evt_cbs_t cbs = {
      .on_conv_done = adc_conv_done_cb,
  };
  ESP_ERROR_CHECK(adc_continuous_register_event_callbacks(adc_handle, &cbs, NULL));
  ESP_ERROR_CHECK(adc_continuous_start(adc_handle));
}

/* 角度算出処理: 差動信号の合成と振幅正規化 */
static void ips_AngleCalculation() 
{
  static int sin_max = INT_MIN;
  static int sin_min = INT_MAX;
  static int cos_max = INT_MIN;
  static int cos_min = INT_MAX;
  int sin_val;
  int cos_val;
  float sin_off;
  float sin_amp;
  float sin_nor;
  float cos_off;
  float cos_amp;
  float cos_nor;
  
  /* sin成分の算出: 正相(SIN)と逆相(SINN)の差分を取り、同相ノイズを除去 */
  int mid   = (sensors[IPS_IDX_SIN_DATA].max + sensors[IPS_IDX_SIN_DATA].min) / 2U;
  int mid_n = (sensors[IPS_IDX_SINN_DATA].max + sensors[IPS_IDX_SINN_DATA].min) / 2U;
  
  sin_val = ((sensors[IPS_IDX_SIN_DATA].val - mid) - (sensors[IPS_IDX_SINN_DATA].val - mid_n));

  /* 振幅の動的正規化: 信号を -1.0 ～ 1.0 の範囲へ近似。オフセット補正も同時に行う */
  sin_max = max(sin_max, sin_val);
  sin_min = min(sin_min, sin_val);
  sin_off = (sin_max + sin_min) / 2.0f;
  sin_amp = (sin_max - sin_min) / 2.0f;
  if (fabs(sin_amp) < 1.0) sin_amp = 1.0;
  sin_nor = (sin_val - sin_off) / sin_amp;

  /* cos成分の算出: 正相(COS)と逆相(COSN)の差分を取り、同相ノイズを除去 */
  mid   = (sensors[IPS_IDX_COS_DATA].max + sensors[IPS_IDX_COS_DATA].min) / 2U;
  mid_n = (sensors[IPS_IDX_COSN_DATA].max + sensors[IPS_IDX_COSN_DATA].min) / 2U;
  
  cos_val = ((sensors[IPS_IDX_COS_DATA].val - mid) - (sensors[IPS_IDX_COSN_DATA].val - mid_n));

  /* 振幅の動的正規化: 信号を -1.0 ～ 1.0 の範囲へ近似。オフセット補正も同時に行う */
  cos_max = max(cos_max, cos_val);
  cos_min = min(cos_min, cos_val);
  cos_off = (cos_max + cos_min) / 2.0f;
  cos_amp = (cos_max - cos_min) / 2.0f;
  if (fabs(cos_amp) < 1.0) cos_amp = 1.0;
  cos_nor = (cos_val - cos_off) / cos_amp;

  /* atan2を用いて位相角を計算 (ラジアンから度への変換) */
  float angle_rad = atan2f(sin_nor, cos_nor);
  float angle_deg = angle_rad * IPS_RAD_TO_DEG;

  /* 負の角度を 0-360度の範囲に補正 */
  if (angle_deg < 0)
  {
    angle_deg += 360.0;
  }
  currentAngle = angle_deg;
#if 0 /* [Debug] */
  LOG_INFO("cos_nor: %.3f, sin_nor: %.3f, angle_deg: %.2f", cos_nor, sin_nor, angle_deg);
#endif /* [Debug] */
}

//==============================================================================
// WebSocket / Wi-Fi / DNS
//==============================================================================

/* Wi-Fiおよびサーバー機能の初期化 */
void Wifi_init() 
{
  // IPアドレスの手動設定
  IPAddress local_IP(IPS_IP_ADDR);
  IPAddress gateway(IPS_IP_ADDR);
  IPAddress subnet(255, 255, 255, 0);
  WiFi.softAPConfig(local_IP, gateway, subnet);

  /* SoftAP開始 */
  if (!WiFi.softAP(ssid, password)) 
  {
    LOG_ERROR("Failed to start SoftAP");
    return;
  }
  WiFi.setSleep(WIFI_PS_NONE);

#if 0 /* [Debug] */
  IPAddress apIP = WiFi.softAPIP();
  String ipStr = apIP.toString();
  LOG_INFO("SSID: %s", ssid);
  LOG_INFO("AP IP address: %s", ipStr.c_str());
#endif /* [Debug] */

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
#if 0 /* [Debug] */
  LOG_INFO("HTTP server started");
#endif /* [Debug] */

  /* WebSocketサーバー設定 */
  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);
#if 0 /* [Debug] */
  LOG_INFO("WebSocket server started");
#endif /* [Debug] */
}

/* ネットワークイベントハンドラ */
void Wifi_HandleNetworkEvent() 
{
  server.handleClient();
  webSocket.loop();
}

/* データ送信: センサー値をバイナリ形式(12byte/point)で一括送信 */
void Wifi_SendBatchData(SensorDataPoint batch[]) 
{
  /* 2byte*4(ADC) + 4byte(float angle) */
  const int POINT_SIZE = sizeof(SensorDataPoint);
  const int totalSize = POINT_SIZE * IPS_SIZE_BATCH;
  static uint8_t buffer[totalSize];

  for (int idx = 0; idx < IPS_SIZE_BATCH; idx++) {
    int offset = idx * POINT_SIZE;
    /* ADC値(uint16_t)をビッグエンディアン形式でパッキング */
    buffer[offset + 0] = (batch[idx].A_Data >> 8) & 0xFF;
    buffer[offset + 1] = batch[idx].A_Data & 0xFF;
    buffer[offset + 2] = (batch[idx].B_Data >> 8) & 0xFF;
    buffer[offset + 3] = batch[idx].B_Data & 0xFF;
    buffer[offset + 4] = (batch[idx].C_Data >> 8) & 0xFF;
    buffer[offset + 5] = batch[idx].C_Data & 0xFF;
    buffer[offset + 6] = (batch[idx].D_Data >> 8) & 0xFF;
    buffer[offset + 7] = batch[idx].D_Data & 0xFF;

    /* float(4byte)をメモリ上のバイト列(リトルエンディアン)としてそのままパッキング */
    uint8_t* angle_bytes = (uint8_t*)&batch[idx].angle;
    buffer[offset + 8]  = angle_bytes[0];
    buffer[offset + 9]  = angle_bytes[1];
    buffer[offset + 10] = angle_bytes[2];
    buffer[offset + 11] = angle_bytes[3];
  }
  /* 接続されている全クライアントへバイナリデータを一斉配信 */
  webSocket.broadcastBIN(buffer, totalSize);
}

/* WebSocketイベントコールバック */
void onWebSocketEvent(uint8_t client_num, WStype_t type, uint8_t* payload, size_t length) 
{
  switch (type) 
  {
    case WStype_CONNECTED:
#if 0 /* [Debug] */
      LOG_INFO("Client [%u] connected", client_num);
#endif /* [Debug] */
      webSocket.sendTXT(client_num, "Welcome!");
      break;

    case WStype_DISCONNECTED:
#if 0 /* [Debug] */
      LOG_INFO("Client [%u] disconnected", client_num);
#endif /* [Debug] */
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
#if 0 /* [Debug] */
      LOG_INFO("Serving file: %s", gStaticFile[idx]);
#endif /* [Debug] */
    } 
    else 
    {
#if 0 /* [Debug] */
      LOG_ERROR("File not found: %s", gStaticFile[idx]);
#endif /* [Debug] */
    }
  }

  /* ディレクトリ単位の配信設定 */
  for (int idx = 0; idx < STATIC_DIR_PATH_COUNT; idx++) 
  {
    server.serveStatic(gStaticDir[idx], LittleFS, gStaticDir[idx]);
#if 0 /* [Debug] */
    LOG_INFO("Serving directory: %s", gStaticDir[idx]);
#endif /* [Debug] */
  }
}

/* Webサーバーのルーティング設定 */
static void server_SetupWebServer() 
{
  /* 404 Not Found */
  server.onNotFound([]() 
  {
#if 0 /* [Debug] */
    LOG_INFO("Request: 404 - Not Found");
#endif /* [Debug] */
    server.send(404, "text/plain", "Not Found");
  });

  /* トップページ ("/") へのアクセス */
  server.on("/", HTTP_GET, []() 
  {
    // LOG_INFO("Request: Top page");
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

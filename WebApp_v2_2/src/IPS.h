/******************************************************************************
 *  File: IPS.h
 *  Description: IPS Angle Calc (Core 0) + WebSocket Server (Core 1)
 *  Target: ESP32-S3-DEV-KIT-N16R8-M
 *  Date: 2026/XX/XX
 *  License: MinebeaMitsumi Inc.
 ******************************************************************************/

#ifndef IPS_H
#define IPS_H

#include <Arduino.h>
#include "IPS_Cfg.h"

//==============================================================================
// Macro
//==============================================================================

#define IPS_NUM_SENSORS             (4U)
#define IPS_IDX_SIN_DATA            (0U)
#define IPS_IDX_COS_DATA            (1U)
#define IPS_IDX_SINN_DATA           (2U)
#define IPS_IDX_COSN_DATA           (3U)

#define IPS_ADC_READ_LEN            (256U)    /* 1回の割り込みで読み出すバイト数 */
#define IPS_SIZE_BATCH              (10U)     /* 1回の通信でまとめて送るデータ数 (20kHzサンプリングで約60Hz送信) */

#define IPS_RAD_TO_DEG              (180.0f / PI)

//==============================================================================
// Struct
//==============================================================================
struct Sensor 
{
  int pin;
  int val;
  int max;
  int min;
};

/* WebSocket通信用の1データ単位 */
struct SensorDataPoint {
  uint16_t A_Data;
  uint16_t B_Data;
  uint16_t C_Data;
  uint16_t D_Data;
  float angle;
};

//==============================================================================
// API Declaration
//==============================================================================
void Esp_Init();
void TaskSensor(void *pvParameters);

#endif // IPS_H

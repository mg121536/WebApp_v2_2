/******************************************************************************
 *  File: IPS_Wifi.h
 *  Description: IPS Angle Calc (Core 0) + WebSocket Server (Core 1)
 *  Target: ESP32-S3-DEV-KIT-N16R8-M
 *  Date: 2026/XX/XX
 *  License: MinebeaMitsumi Inc.
 ******************************************************************************/

#ifndef IPS_WIFI_H
#define IPS_WIFI_H

//==============================================================================
// Include
//==============================================================================

#include <WiFi.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <IPS.h>

//==============================================================================
// Macro
//==============================================================================

// ★ どちらか一方のコメントアウトを外してビルドしてください ★
#define DEVICE_TYPE_IPS
// #define DEVICE_TYPE_VIR

#ifdef DEVICE_TYPE_IPS
  // 1台目 (IPS) の設定
  #define IPS_WIFI_SSID        ("NMB_AMR_IPS")
  #define IPS_WIFI_PASSWORD    ("12345678")
  #define IPS_IP_ADDR          192, 168, 10, 1   // 例: 192.168.10.1
#elif defined(DEVICE_TYPE_VIR)
  // 2台目 (VIR) の設定
  #define IPS_WIFI_SSID        ("NMB_AMR_VIR")
  #define IPS_WIFI_PASSWORD    ("12345678")
  #define IPS_IP_ADDR          192, 168, 20, 1   // 例: 192.168.20.1
#else
  // デフォルト（元の設定）
  #define IPS_WIFI_SSID        ("NMB_AMR")
  #define IPS_WIFI_PASSWORD    ("12345678")
  #define IPS_IP_ADDR          192, 168, 4, 1
#endif

//==============================================================================
// API Declaration
//==============================================================================
void Wifi_init();
void Wifi_HandleNetworkEvent();
void Wifi_SendBatchData(SensorDataPoint batch[]);
void onWebSocketEvent(uint8_t client_num, WStype_t type, uint8_t* payload, size_t length);

#endif // IPS_WIFI_H

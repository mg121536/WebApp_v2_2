/******************************************************************************
 *  File: IPS_Wifi.h
 *  Description: Wi-Fi and Server configuration.
 *  Target: ESP32-S3-DEV-KIT-N16R8-M
 *  Date: 2025/XX/XX
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

//==============================================================================
// Macro
//==============================================================================

#define IPS_WIFI_SSID        ("NMB_AMR")
#define IPS_WIFI_PASSWORD    ("12345678")

#endif // IPS_WIFI_H

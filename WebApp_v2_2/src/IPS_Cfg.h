/******************************************************************************
 *  File: IPS_Cfg.h
 *  Description: IPS Angle Calc (Core 0) + WebSocket Server (Core 1)
 *  Target: ESP32-S3-DEV-KIT-N16R8-M
 *  Date: 2026/XX/XX
 *  License: MinebeaMitsumi Inc.
 ******************************************************************************/

#ifndef IPS_CFG_H
#define IPS_CFG_H

//==============================================================================
// Configuration
//==============================================================================


//==============================================================================
// Parameters
//==============================================================================
#define IPS_CFG_ADC_MIN_VALUE      (0x000UL)
#define IPS_CFG_ADC_MAX_VALUE      (0xFFFUL)
#define IPS_CFG_ADC_MID_VALUE      ((IPS_CFG_ADC_MIN_VALUE + IPS_CFG_ADC_MAX_VALUE) / 2U)

//==============================================================================
// System Settings
//==============================================================================

#define IPS_CFG_ESP_STARTUP_DELAY  (500U)
#define IPS_CFG_SERIAL_BAUDRATE    (115200U)

//==============================================================================
// GPIO Configuration for Rotary Encoder (IPS2550)
//==============================================================================

#define IPS_CFG_PORT_GPIO_COS      (4U)  /* GPIO4 - Cos (赤) */
#define IPS_CFG_PORT_GPIO_SIN      (5U)  /* GPIO5 - Sin (青) */
#define IPS_CFG_PORT_GPIO_COSN     (6U)  /* GPIO6 - CosN(緑) */
#define IPS_CFG_PORT_GPIO_SINN     (7U)  /* GPIO7 - SinN(黒) */

#endif /* IPS_CFG_H */

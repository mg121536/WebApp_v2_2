/******************************************************************************
 *  File: IPS_Cfg.h
 *  Description: Sensor structures and calculation constants.
 *  Target: ESP32-S3-DEV-KIT-N16R8-M
 *  Date: 2025/XX/XX
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
#define IPS_CFG_ADC_BITS           (12U)
#define IPS_CFG_ADC_INPUT_V_RANGE  (ADC_11db)

/* Constants for calculation */
#define IPS_CFG_ADC_MIN_VALUE      (0x000UL)
#define IPS_CFG_ADC_MAX_VALUE      (0xFFFUL)
#define IPS_CFG_ADC_MID_VALUE      ((IPS_CFG_ADC_MIN_VALUE + IPS_CFG_ADC_MAX_VALUE) / 2U)

//==============================================================================
// System Settings
//==============================================================================

#define IPS_CFG_ESP_STARTUP_DELAY  (500U)
#define IPS_CFG_SERIAL_BAUDRATE    (115200U)
#define IPS_CFG_WIFI_TX_INTERVAL   (20U)

//==============================================================================
// GPIO Configuration for Rotary Encoder (IPS2550)
//==============================================================================

#define IPS_CFG_PORT_GPIO_COS      (4U)  /* IO5 - Cos (赤) */
#define IPS_CFG_PORT_GPIO_SIN      (5U)  /* IO4 - Sin (青) */
#define IPS_CFG_PORT_GPIO_COSN     (6U)  /* IO7 - CosN(緑) */
#define IPS_CFG_PORT_GPIO_SINN     (7U)  /* IO6 - SinN(黒) */

#endif /* IPS_CFG_H */

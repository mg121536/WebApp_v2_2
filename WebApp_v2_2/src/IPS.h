/******************************************************************************
 *  File: IPS.h
 *  Description: Reads analog signals (sin and cos) from rotary encoder and
 *               calculates angle of rotation in degrees.
 *  Target: ESP32-S3-DEV-KIT-N16R8-M
 *  Date: 2025/XX/XX
 *  License: MinebeaMitsumi Inc.
 ******************************************************************************/

#ifndef IPS_H
#define IPS_H

#include "IPS_Cfg.h"

//==============================================================================
// Macro
//==============================================================================

#define IPS_NUM_SENSORS             (4U)
#define IPS_IDX_SIN_DATA            (0U)
#define IPS_IDX_COS_DATA            (1U)
#define IPS_IDX_SINN_DATA           (2U)
#define IPS_IDX_COSN_DATA           (3U)

#define IPS_ADC_MID_VALUE           (IPS_CFG_ADC_MAX_VALUE / 2U)
#define IPS_ANALOG_NUM_READ_SAMPLE  (8U)
#define IPS_ANALOG_RANGE            (IPS_CFG_TEST_RANGE)
#define IPS_ANALOG_RANGE_MID        (IPS_ANALOG_RANGE / 2U)
#define IPS_ANGLE_DEG_PER_RAD       (180.0 / PI)

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

#endif // IPS_H

/******************************************************************************
 *  File: IPS_Debug.h
 *  Description: IPS Angle Calc (Core 0) + WebSocket Server (Core 1)
 *  Target: ESP32-S3-DEV-KIT-N16R8-M
 *  Date: 2026/XX/XX
 *  License: MinebeaMitsumi Inc.
 ******************************************************************************/

#ifndef IPS_DEBUG_H
#define IPS_DEBUG_H

#include <Arduino.h>
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"


//==============================================================================
// Configuration
//==============================================================================
/* Global debug switch (Set to 1U to enable debugging) */
#define IPS_DEBUG        (0U)

/* Log level switches (1 = Enable, 0 = Disable) */
#define LOG_LVL_ERROR    (0U)
#define LOG_LVL_WARN     (0U)
#define LOG_LVL_INFO     (0U)
#define LOG_LVL_DEBUG    (0U)

//==============================================================================
// Macro
//==============================================================================

#if IPS_DEBUG

  /* Semaphore timeout for Serial logging */
  #define SERIAL_SEM_TIMEOUT   pdMS_TO_TICKS(10)

  /* Semaphore for serial output synchronization between cores */
  extern SemaphoreHandle_t xSerialSemaphore;

  /* Common macro for thread-safe logging */
  #define SAFE_LOG_PRINT(level, fmt, ...) do { \
      bool taken = false; \
      /* Check if semaphore exists and attempt to take it (timeout: 10ms) */ \
      if (xSerialSemaphore != NULL) { \
        if (xSemaphoreTake(xSerialSemaphore, SERIAL_SEM_TIMEOUT) == pdTRUE) { \
          taken = true; \
        } \
      } \
      /* Output log if semaphore is taken or if it doesn't exist (early boot) */ \
      if (xSerialSemaphore == NULL || taken) { \
        Serial.printf("[%lu] %s " fmt "\n", (unsigned long)millis(), level, ##__VA_ARGS__); \
      } \
      /* Release the semaphore if it was successfully taken */ \
      if (taken) { \
        xSemaphoreGive(xSerialSemaphore); \
      } \
    } while (0)

  #if LOG_LVL_ERROR
    #define LOG_ERROR(fmt, ...) SAFE_LOG_PRINT("ERROR: ", fmt, ##__VA_ARGS__)
  #else
    #define LOG_ERROR(...)      do {} while (0)
  #endif

  #if LOG_LVL_WARN
    #define LOG_WARN(fmt, ...)  SAFE_LOG_PRINT("WARN:  ", fmt, ##__VA_ARGS__)
  #else
    #define LOG_WARN(...)       do {} while (0)
  #endif

  #if LOG_LVL_INFO
    #define LOG_INFO(fmt, ...)  SAFE_LOG_PRINT("INFO:  ", fmt, ##__VA_ARGS__)
  #else
    #define LOG_INFO(...)       do {} while (0)
  #endif

  #if LOG_LVL_DEBUG
    #define LOG_DEBUG(fmt, ...) SAFE_LOG_PRINT("DEBUG: ", fmt, ##__VA_ARGS__)
  #else
    #define LOG_DEBUG(...)      do {} while (0)
  #endif

#else
  /* Disable all logs if IPS_DEBUG is 0 */
  #define LOG_ERROR(...)    do {} while (0)
  #define LOG_WARN(...)     do {} while (0)
  #define LOG_INFO(...)     do {} while (0)
  #define LOG_DEBUG(...)    do {} while (0)
#endif

#endif /* IPS_DEBUG_H */

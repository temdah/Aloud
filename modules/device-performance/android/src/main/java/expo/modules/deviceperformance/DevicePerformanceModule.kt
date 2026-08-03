package expo.modules.deviceperformance

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DevicePerformanceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DevicePerformance")

    Function("getSnapshot") {
      val context = appContext.reactContext ?: return@Function emptyMap<String, Any?>()
      val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      val memory = ActivityManager.MemoryInfo()
      activityManager.getMemoryInfo(memory)

      val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      val battery = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
      val batteryLevel = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
      val batteryScale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
      val batteryTemperatureTenths = battery?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1) ?: -1

      mapOf(
        "availableMemoryBytes" to memory.availMem.toDouble(),
        "totalMemoryBytes" to memory.totalMem.toDouble(),
        "lowMemory" to memory.lowMemory,
        "memoryThresholdBytes" to memory.threshold.toDouble(),
        "appMemoryClassMb" to activityManager.memoryClass,
        "largeAppMemoryClassMb" to activityManager.largeMemoryClass,
        "cpuCores" to Runtime.getRuntime().availableProcessors(),
        "powerSaveMode" to powerManager.isPowerSaveMode,
        "thermalStatus" to if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) powerManager.currentThermalStatus else null,
        "batteryPercent" to if (batteryLevel >= 0 && batteryScale > 0) batteryLevel * 100.0 / batteryScale else null,
        "batteryTemperatureC" to if (batteryTemperatureTenths >= 0) batteryTemperatureTenths / 10.0 else null,
      )
    }
  }
}

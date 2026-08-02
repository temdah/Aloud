import { requireOptionalNativeModule } from 'expo-modules-core';

export type DevicePerformanceSnapshot = {
  availableMemoryBytes: number;
  totalMemoryBytes: number;
  lowMemory: boolean;
  memoryThresholdBytes: number;
  appMemoryClassMb: number;
  largeAppMemoryClassMb: number;
  cpuCores: number;
  powerSaveMode: boolean;
  thermalStatus: number | null;
  batteryPercent: number | null;
  batteryTemperatureC: number | null;
};

type DevicePerformanceNativeModule = {
  getSnapshot(): DevicePerformanceSnapshot;
};

export default requireOptionalNativeModule<DevicePerformanceNativeModule>('DevicePerformance');

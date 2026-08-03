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

export type DevicePerformanceNativeModule = {
  getSnapshot(): DevicePerformanceSnapshot;
};

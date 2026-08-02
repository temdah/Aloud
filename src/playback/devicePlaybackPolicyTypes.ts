export type DevicePressure = 'normal' | 'constrained' | 'critical';

export type DevicePlaybackSnapshot = {
  availableMemoryBytes: number;
  totalMemoryBytes: number;
  lowMemory: boolean;
  memoryThresholdBytes: number;
  appMemoryClassMb: number;
  cpuCores: number;
  powerSaveMode: boolean;
  thermalStatus: number | null;
};

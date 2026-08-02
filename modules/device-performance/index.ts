import DevicePerformanceModule, { type DevicePerformanceSnapshot } from './src/DevicePerformanceModule';

export type { DevicePerformanceSnapshot } from './src/DevicePerformanceModule';

export function getDevicePerformanceSnapshot(): DevicePerformanceSnapshot | null {
  return DevicePerformanceModule?.getSnapshot() ?? null;
}

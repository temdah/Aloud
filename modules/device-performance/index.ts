import DevicePerformanceModule from './src/DevicePerformanceModule';
import type { DevicePerformanceSnapshot } from './src/DevicePerformanceTypes';

export type { DevicePerformanceSnapshot } from './src/DevicePerformanceTypes';

export function getDevicePerformanceSnapshot(): DevicePerformanceSnapshot | null {
  return DevicePerformanceModule?.getSnapshot() ?? null;
}

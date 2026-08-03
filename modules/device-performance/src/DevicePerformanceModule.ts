import { requireOptionalNativeModule } from 'expo-modules-core';
import type { DevicePerformanceNativeModule } from './DevicePerformanceTypes';

export default requireOptionalNativeModule<DevicePerformanceNativeModule>('DevicePerformance');

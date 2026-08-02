import { jest } from '@jest/globals';

jest.mock('onnxruntime-react-native', () => ({
  InferenceSession: { create: jest.fn() },
  Tensor: class Tensor {},
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(),
  useAudioPlayerStatus: jest.fn(),
}));

jest.mock('../modules/aac-codec', () => ({
  concatM4a: jest.fn(),
  encodeFloatPcmToM4a: jest.fn(),
  encodePcmToM4a: jest.fn(),
  encodeWavsToM4a: jest.fn(),
}));

jest.mock('../modules/device-performance', () => ({
  getDevicePerformanceSnapshot: jest.fn(() => null),
}));

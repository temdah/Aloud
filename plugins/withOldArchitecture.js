// Expo config plugin that forces React Native's OLD architecture
// (newArchEnabled=false) in android/gradle.properties on every prebuild.
//
// onnxruntime-react-native 1.24.3 (the TTS engine) is a legacy-bridge module:
// its install() uses getCatalystInstance(), which does not exist under
// bridgeless New Architecture and crashes there. The SDK 56 prebuild template
// defaults this flag to `true` and the app.json `newArchEnabled` field does not
// reliably override it, so we pin it here.
const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withOldArchitecture(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const existing = props.find((p) => p.type === 'property' && p.key === 'newArchEnabled');
    if (existing) {
      existing.value = 'false';
    } else {
      props.push({ type: 'property', key: 'newArchEnabled', value: 'false' });
    }
    return cfg;
  });
};

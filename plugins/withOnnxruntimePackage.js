// Expo config plugin that registers onnxruntime-react-native's ReactPackage in
// MainApplication. ORT 1.24.3 is a legacy-bridge module that Expo autolinking
// does not register, so without this the native module is null at runtime
// (`NativeModules.Onnxruntime` -> install() crash). Runs on every prebuild.
const { withMainApplication } = require('@expo/config-plugins');

const PACKAGE_CALL = 'add(ai.onnxruntime.reactnative.OnnxruntimePackage())';
const ANCHOR = /PackageList\(this\)\.packages\.apply\s*\{/;

module.exports = function withOnnxruntimePackage(config) {
  return withMainApplication(config, (cfg) => {
    const { contents } = cfg.modResults;

    if (contents.includes(PACKAGE_CALL)) {
      return cfg;
    }

    if (!ANCHOR.test(contents)) {
      throw new Error(
        '[withOnnxruntimePackage] Could not find the `PackageList(this).packages.apply {` ' +
          'anchor in MainApplication. The Expo template may have changed — update this plugin.',
      );
    }

    cfg.modResults.contents = contents.replace(
      ANCHOR,
      (match) =>
        `${match}\n          // onnxruntime-react-native: legacy ReactPackage that Expo autolinking misses.\n          ${PACKAGE_CALL}`,
    );
    return cfg;
  });
};

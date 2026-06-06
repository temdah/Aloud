// Expo config plugin that wires a *release* signing config into
// android/app/build.gradle on every prebuild (CNG regenerates this file, so the
// edit can't be made by hand).
//
// The release key is read from Gradle properties — keep them OUT of the repo,
// e.g. in ~/.gradle/gradle.properties:
//
//   PDFREADALOUD_RELEASE_STORE_FILE=C:/Users/you/keys/pdfreadaloud-release.keystore
//   PDFREADALOUD_RELEASE_STORE_PASSWORD=********
//   PDFREADALOUD_RELEASE_KEY_ALIAS=pdfreadaloud
//   PDFREADALOUD_RELEASE_KEY_PASSWORD=********
//
// When those properties are absent (e.g. a teammate's machine, CI without
// secrets) the release build falls back to the debug keystore, so dev release
// builds (`expo run:android --variant release`) still work unsigned-for-store.
const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = 'PDFREADALOUD_RELEASE_STORE_FILE';

// Inserted as a sibling of the `debug` signingConfig.
const RELEASE_SIGNING_CONFIG = [
  '        release {',
  `            if (project.hasProperty('${MARKER}')) {`,
  '                storeFile file(PDFREADALOUD_RELEASE_STORE_FILE)',
  '                storePassword PDFREADALOUD_RELEASE_STORE_PASSWORD',
  '                keyAlias PDFREADALOUD_RELEASE_KEY_ALIAS',
  '                keyPassword PDFREADALOUD_RELEASE_KEY_PASSWORD',
  '            }',
  '        }',
  '',
].join('\n');

const SIGNING_ANCHOR = '    signingConfigs {\n        debug {';

// The release buildType in the RN template signs with the debug key and carries
// this exact two-line caution comment — unique, so it's a safe anchor.
const RELEASE_BUILDTYPE_ORIGINAL = [
  '            // Caution! In production, you need to generate your own keystore file.',
  '            // see https://reactnative.dev/docs/signed-apk-android.',
  '            signingConfig signingConfigs.debug',
].join('\n');

const RELEASE_BUILDTYPE_REPLACEMENT =
  `            signingConfig project.hasProperty('${MARKER}') ? signingConfigs.release : signingConfigs.debug`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    // Idempotent: prebuild may run this plugin against an already-patched file.
    if (contents.includes(MARKER)) {
      return cfg;
    }

    if (!contents.includes(SIGNING_ANCHOR)) {
      throw new Error(
        '[withReleaseSigning] Could not find the `signingConfigs { debug {` anchor in ' +
          'app/build.gradle. The RN/Expo template may have changed — update this plugin.',
      );
    }
    contents = contents.replace(SIGNING_ANCHOR, `    signingConfigs {\n${RELEASE_SIGNING_CONFIG}        debug {`);

    if (!contents.includes(RELEASE_BUILDTYPE_ORIGINAL)) {
      throw new Error(
        '[withReleaseSigning] Could not find the release buildType debug-signing block in ' +
          'app/build.gradle. The RN/Expo template may have changed — update this plugin.',
      );
    }
    contents = contents.replace(RELEASE_BUILDTYPE_ORIGINAL, RELEASE_BUILDTYPE_REPLACEMENT);

    cfg.modResults.contents = contents;
    return cfg;
  });
};

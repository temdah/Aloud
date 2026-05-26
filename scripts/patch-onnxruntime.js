// Re-applies the Gradle 9 compatibility fix to onnxruntime-react-native after
// install. ORT 1.24.3's android/build.gradle uses `VersionNumber`, an API
// removed in Gradle 9 (React Native 0.85 ships Gradle 9.3.1). The reference is
// a dead "RN < 0.71" check, so we replace it with a string-based comparison.
// Runs from package.json "postinstall"; idempotent.
const fs = require('node:fs');
const path = require('node:path');

const buildGradle = path.join(
  __dirname,
  '..',
  'node_modules',
  'onnxruntime-react-native',
  'android',
  'build.gradle',
);

const ORIGINAL = '  if (VersionNumber.parse(REACT_NATIVE_VERSION) < VersionNumber.parse("0.71")) {';
const REPLACEMENT = [
  "  def rnParts = REACT_NATIVE_VERSION.tokenize('.-')",
  '  def rnBelow071 = (rnParts[0].toInteger() == 0 && rnParts[1].toInteger() < 71)',
  '  if (rnBelow071) {',
].join('\n');

if (!fs.existsSync(buildGradle)) {
  console.log('[patch-onnxruntime] onnxruntime-react-native not installed, skipping.');
  process.exit(0);
}

const source = fs.readFileSync(buildGradle, 'utf8');

if (!source.includes('VersionNumber.parse')) {
  console.log('[patch-onnxruntime] Already patched.');
  process.exit(0);
}

if (!source.includes(ORIGINAL)) {
  console.warn(
    '[patch-onnxruntime] Found VersionNumber usage but not the expected line; ' +
      'onnxruntime-react-native may have changed — review the patch.',
  );
  process.exit(0);
}

fs.writeFileSync(buildGradle, source.replace(ORIGINAL, REPLACEMENT), 'utf8');
console.log('[patch-onnxruntime] Applied Gradle 9 compatibility patch.');

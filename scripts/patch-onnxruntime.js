// Post-install patches for onnxruntime-react-native. Runs from package.json
// "postinstall"; every patch below is idempotent and self-skips if the upstream
// package has changed, so a version bump degrades to a warning rather than a
// hard failure. Two patches are applied:
//
//   1. Gradle 9 compatibility — ORT 1.24.3's android/build.gradle uses
//      `VersionNumber`, an API removed in Gradle 9 (RN 0.85 ships Gradle 9.3.1).
//      The reference guards a dead "RN < 0.71" check, so we swap it for a
//      string-based comparison.
//
//   2. 16 KB ELF alignment — libonnxruntimejsi.so is the only .so compiled from
//      source in our build. NDK r27 still defaults to 4 KB max-page-size (16 KB
//      became the default in r28), so without an explicit linker flag this lib
//      fails Android 16 / Play's 16 KB page-size requirement. We inject the flag
//      into the module's CMakeLists.txt.
const fs = require('node:fs');
const path = require('node:path');

const moduleDir = path.join(__dirname, '..', 'node_modules', 'onnxruntime-react-native', 'android');

// --- Patch 1: Gradle 9 compatibility (build.gradle) ---------------------------
function patchGradle9() {
  const buildGradle = path.join(moduleDir, 'build.gradle');

  const ORIGINAL = '  if (VersionNumber.parse(REACT_NATIVE_VERSION) < VersionNumber.parse("0.71")) {';
  const REPLACEMENT = [
    "  def rnParts = REACT_NATIVE_VERSION.tokenize('.-')",
    '  def rnBelow071 = (rnParts[0].toInteger() == 0 && rnParts[1].toInteger() < 71)',
    '  if (rnBelow071) {',
  ].join('\n');

  if (!fs.existsSync(buildGradle)) {
    console.log('[patch-onnxruntime] build.gradle missing, skipping Gradle 9 patch.');
    return;
  }

  const source = fs.readFileSync(buildGradle, 'utf8');

  if (!source.includes('VersionNumber.parse')) {
    console.log('[patch-onnxruntime] Gradle 9 patch already applied.');
    return;
  }

  if (!source.includes(ORIGINAL)) {
    console.warn(
      '[patch-onnxruntime] Found VersionNumber usage but not the expected line; ' +
        'onnxruntime-react-native may have changed — review the Gradle 9 patch.',
    );
    return;
  }

  fs.writeFileSync(buildGradle, source.replace(ORIGINAL, REPLACEMENT), 'utf8');
  console.log('[patch-onnxruntime] Applied Gradle 9 compatibility patch.');
}

// --- Patch 2: 16 KB ELF alignment (CMakeLists.txt) ----------------------------
function patch16kAlignment() {
  const cmake = path.join(moduleDir, 'CMakeLists.txt');

  // The flag must be attached AFTER add_library() defines the target, so we
  // anchor on target_link_libraries() and insert just above it.
  const ANCHOR = 'target_link_libraries(\n  onnxruntimejsi';
  const INJECT =
    '# 16 KB page alignment (Android 16 / Play requirement). NDK r27 still\n' +
    '# defaults to 4 KB; this is the only .so we compile from source.\n' +
    'target_link_options(onnxruntimejsi PRIVATE\n' +
    '  "-Wl,-z,max-page-size=16384,-z,common-page-size=16384")\n\n';

  if (!fs.existsSync(cmake)) {
    console.log('[patch-onnxruntime] CMakeLists.txt missing, skipping 16 KB patch.');
    return;
  }

  // Self-heal: strip any prior injection (incl. a mis-placed earlier one) so
  // re-running always lands the block in the correct spot. Idempotent.
  const cleaned = fs.readFileSync(cmake, 'utf8').split(INJECT).join('');

  if (!cleaned.includes(ANCHOR)) {
    console.warn(
      '[patch-onnxruntime] Could not find the target_link_libraries anchor; ' +
        'onnxruntime-react-native may have changed — review the 16 KB patch.',
    );
    return;
  }

  fs.writeFileSync(cmake, cleaned.replace(ANCHOR, INJECT + ANCHOR), 'utf8');
  console.log('[patch-onnxruntime] Applied 16 KB alignment patch.');
}

patchGradle9();
patch16kAlignment();

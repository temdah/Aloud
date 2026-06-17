// Post-install patches for expo-audio. Runs from package.json "postinstall"
// alongside patch-onnxruntime.js. Every patch is idempotent and self-skips if the
// upstream package has changed, so a version bump degrades to a warning rather
// than a hard failure.
//
// Goal: let the Android media notification adopt the app's accent color instead
// of the default grey/blue. The stock expo-audio notification builder never calls
// setColor()/setColorized(), so we (1) add an `accentColor` field to the
// AudioLockScreenOptions record, (2) colorize the notification when it's present,
// and (3) surface the field on the TypeScript type so callers can pass it.
const fs = require('node:fs');
const path = require('node:path');

const androidDir = path.join(__dirname, '..', 'node_modules', 'expo-audio', 'android', 'src', 'main', 'java', 'expo', 'modules', 'audio');
const buildDir = path.join(__dirname, '..', 'node_modules', 'expo-audio', 'build');

// --- Patch 1: add `accentColor` to the AudioLockScreenOptions record ----------
function patchOptionsRecord() {
  const file = path.join(androidDir, 'AudioRecords.kt');
  if (!fs.existsSync(file)) {
    console.log('[patch-expo-audio] AudioRecords.kt missing, skipping options patch.');
    return;
  }
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('val accentColor')) {
    console.log('[patch-expo-audio] options record already patched.');
    return;
  }
  const ANCHOR = '  @Field val isLiveStream: Boolean? = null\n) : Record';
  const REPLACEMENT = '  @Field val isLiveStream: Boolean? = null,\n  @Field val accentColor: String? = null\n) : Record';
  if (!source.includes(ANCHOR)) {
    console.warn('[patch-expo-audio] AudioLockScreenOptions shape changed — review the options patch.');
    return;
  }
  fs.writeFileSync(file, source.replace(ANCHOR, REPLACEMENT), 'utf8');
  console.log('[patch-expo-audio] Added accentColor to AudioLockScreenOptions.');
}

// --- Patch 2: colorize the notification + import Color ------------------------
function patchNotificationColor() {
  const file = path.join(androidDir, 'service', 'AudioControlsService.kt');
  if (!fs.existsSync(file)) {
    console.log('[patch-expo-audio] AudioControlsService.kt missing, skipping color patch.');
    return;
  }
  let source = fs.readFileSync(file, 'utf8');

  // 2a. import android.graphics.Color (anchor on an existing graphics import).
  if (!source.includes('import android.graphics.Color')) {
    const IMPORT_ANCHOR = 'import android.graphics.BitmapFactory';
    if (source.includes(IMPORT_ANCHOR)) {
      source = source.replace(IMPORT_ANCHOR, IMPORT_ANCHOR + '\nimport android.graphics.Color');
    } else {
      console.warn('[patch-expo-audio] graphics import anchor missing — review the color patch.');
      return;
    }
  }

  // 2b. setColor/setColorized in buildNotification, just before the MediaStyle.
  const ANCHOR = '    val style = MediaStyleNotificationHelper.MediaStyle(session)';
  const INJECT =
    '    // Colorize the notification with the app accent (patched by\n' +
    '    // scripts/patch-expo-audio.js) instead of the system default.\n' +
    '    currentOptions?.accentColor?.let {\n' +
    '      try {\n' +
    '        builder.setColor(Color.parseColor(it))\n' +
    '        builder.setColorized(true)\n' +
    '      } catch (e: Exception) {\n' +
    '      }\n' +
    '    }\n\n';

  // Self-heal: strip any prior injection so re-running re-lands it cleanly.
  source = source.split(INJECT).join('');
  if (!source.includes(ANCHOR)) {
    console.warn('[patch-expo-audio] MediaStyle anchor missing — review the color patch.');
    return;
  }
  source = source.replace(ANCHOR, INJECT + ANCHOR);

  fs.writeFileSync(file, source, 'utf8');
  console.log('[patch-expo-audio] Applied notification colorize patch.');
}

// --- Patch 3: surface accentColor on the TS type ------------------------------
function patchTsType() {
  const file = path.join(buildDir, 'AudioConstants.d.ts');
  if (!fs.existsSync(file)) {
    console.log('[patch-expo-audio] AudioConstants.d.ts missing, skipping type patch.');
    return;
  }
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('accentColor')) {
    console.log('[patch-expo-audio] TS type already patched.');
    return;
  }
  const ANCHOR = '    isLiveStream?: boolean;\n};';
  const REPLACEMENT =
    '    isLiveStream?: boolean;\n' +
    '    /** Accent color (hex) for the Android media notification background. Patched in by scripts/patch-expo-audio.js. */\n' +
    '    accentColor?: string;\n};';
  if (!source.includes(ANCHOR)) {
    console.warn('[patch-expo-audio] AudioLockScreenOptions type shape changed — review the type patch.');
    return;
  }
  fs.writeFileSync(file, source.replace(ANCHOR, REPLACEMENT), 'utf8');
  console.log('[patch-expo-audio] Added accentColor to the TS type.');
}

patchOptionsRecord();
patchNotificationColor();
patchTsType();

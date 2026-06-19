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

// --- Patch 4: a speed-cycle button on the media notification ------------------
// Adds an `accentColor`-style `showSpeed` option and, when set, a playback-speed
// CommandButton (Android 13+ custom layout). Pressing it cycles the player's rate
// 1.0 -> 1.25 -> 1.5 -> 1.0; JS observes status.playbackRate and mirrors it into
// settings, so the in-app speed + neutral-rate cache stay the single source.
function patchSpeedOption() {
  const file = path.join(androidDir, 'AudioRecords.kt');
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('val showSpeed')) {
    console.log('[patch-expo-audio] showSpeed option already present.');
    return;
  }
  const ANCHOR = '  @Field val accentColor: String? = null\n) : Record';
  const REPLACEMENT = '  @Field val accentColor: String? = null,\n  @Field val showSpeed: Boolean? = null\n) : Record';
  if (!source.includes(ANCHOR)) {
    console.warn('[patch-expo-audio] accentColor anchor missing — run the color patch first; skipping showSpeed.');
    return;
  }
  fs.writeFileSync(file, source.replace(ANCHOR, REPLACEMENT), 'utf8');
  console.log('[patch-expo-audio] Added showSpeed to AudioLockScreenOptions.');
}

function patchSpeedButton() {
  const file = path.join(androidDir, 'service', 'AudioControlsService.kt');
  if (!fs.existsSync(file)) return;
  let source = fs.readFileSync(file, 'utf8');

  // 4a. ACTION_SPEED constant.
  if (!source.includes('ACTION_SPEED')) {
    const ANCHOR = '    const val ACTION_SEEK_BACKWARD = "expo.modules.audio.action.SEEK_BACKWARD"';
    if (!source.includes(ANCHOR)) {
      console.warn('[patch-expo-audio] seek-action const anchor missing — skipping speed button.');
      return;
    }
    source = source.replace(ANCHOR, ANCHOR + '\n    const val ACTION_SPEED = "expo.modules.audio.action.SPEED"');
  }

  // 4b. Speed CommandButton in the Android 13+ custom layout (overflow slot).
  const BTN_INJECT =
    '    if (currentOptions?.showSpeed == true) {\n' +
    '      mediaButtons.add(\n' +
    '        CommandButton.Builder(CommandButton.ICON_PLAYBACK_SPEED)\n' +
    '          .setDisplayName("Speed")\n' +
    '          .setEnabled(true)\n' +
    '          .setSessionCommand(SessionCommand(ACTION_SPEED, Bundle.EMPTY))\n' +
    '          .setSlots(CommandButton.SLOT_OVERFLOW)\n' +
    '          .build()\n' +
    '      )\n' +
    '    }\n\n';
  const BTN_ANCHOR = '    session.setCustomLayout(mediaButtons)';
  source = source.split(BTN_INJECT).join(''); // self-heal
  if (!source.includes(BTN_ANCHOR)) {
    console.warn('[patch-expo-audio] setCustomLayout anchor missing — skipping speed button.');
    return;
  }
  source = source.replace(BTN_ANCHOR, BTN_INJECT + BTN_ANCHOR);

  fs.writeFileSync(file, source, 'utf8');
  console.log('[patch-expo-audio] Applied speed button to the custom layout.');
}

function patchSpeedCommand() {
  const file = path.join(androidDir, 'service', 'AudioMediaSessionCallback.kt');
  if (!fs.existsSync(file)) return;
  let source = fs.readFileSync(file, 'utf8');

  // 4c. Make ACTION_SPEED an available session command.
  if (!source.includes('ACTION_SPEED, Bundle.EMPTY')) {
    const ANCHOR =
      '            .add(SessionCommand(AudioControlsService.ACTION_SEEK_FORWARD, Bundle.EMPTY))\n' +
      '            .build()';
    if (!source.includes(ANCHOR)) {
      console.warn('[patch-expo-audio] session-commands anchor missing — skipping speed command.');
      return;
    }
    source = source.replace(
      ANCHOR,
      '            .add(SessionCommand(AudioControlsService.ACTION_SEEK_FORWARD, Bundle.EMPTY))\n' +
        '            .add(SessionCommand(AudioControlsService.ACTION_SPEED, Bundle.EMPTY))\n' +
        '            .build()',
    );
  }

  // 4d. Handle ACTION_SPEED: cycle 1.0 -> 1.25 -> 1.5 -> 1.0, preserving pitch.
  if (!source.includes('AudioControlsService.ACTION_SPEED ->')) {
    const ANCHOR =
      '      AudioControlsService.ACTION_SEEK_BACKWARD -> {\n' +
      '        session.player.seekTo(session.player.currentPosition - AudioControlsService.SEEK_INTERVAL_MS)\n' +
      '      }\n' +
      '    }';
    if (!source.includes(ANCHOR)) {
      console.warn('[patch-expo-audio] onCustomCommand anchor missing — skipping speed handler.');
      return;
    }
    source = source.replace(
      ANCHOR,
      '      AudioControlsService.ACTION_SEEK_BACKWARD -> {\n' +
        '        session.player.seekTo(session.player.currentPosition - AudioControlsService.SEEK_INTERVAL_MS)\n' +
        '      }\n' +
        '      AudioControlsService.ACTION_SPEED -> {\n' +
        '        val cur = session.player.playbackParameters.speed\n' +
        '        val next = when {\n' +
        '          cur < 1.13f -> 1.25f\n' +
        '          cur < 1.38f -> 1.5f\n' +
        '          else -> 1.0f\n' +
        '        }\n' +
        '        session.player.playbackParameters = androidx.media3.common.PlaybackParameters(next, 1f)\n' +
        '      }\n' +
        '    }',
    );
  }

  fs.writeFileSync(file, source, 'utf8');
  console.log('[patch-expo-audio] Applied speed command handler.');
}

function patchSpeedTsType() {
  const file = path.join(buildDir, 'AudioConstants.d.ts');
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('showSpeed')) return;
  const ANCHOR = '    accentColor?: string;';
  if (!source.includes(ANCHOR)) return;
  fs.writeFileSync(
    file,
    source.replace(
      ANCHOR,
      ANCHOR +
        '\n    /** Show a playback-speed cycle button on the media notification (Android). Patched in by scripts/patch-expo-audio.js. */\n    showSpeed?: boolean;',
    ),
    'utf8',
  );
  console.log('[patch-expo-audio] Added showSpeed to the TS type.');
}

patchOptionsRecord();
patchNotificationColor();
patchTsType();
patchSpeedOption();
patchSpeedButton();
patchSpeedCommand();
patchSpeedTsType();

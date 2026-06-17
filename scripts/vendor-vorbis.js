// Fetches the Xiph C sources needed by the `vorbis-codec` local Expo module and
// vendors them under its cpp/third_party dir (gitignored). Runs from "postinstall".
//
// We use Ogg Vorbis (not Opus) because the TTS model outputs 44.1 kHz, which Opus
// can't encode without resampling; Vorbis encodes 44.1 kHz natively. libvorbis
// ships libvorbis + libvorbisenc + libvorbisfile, and depends on libogg.
//
// Idempotent: each library is skipped if already extracted. Network/extraction
// failures degrade to a warning (the native build will fail later with a clear
// "missing third_party" error rather than this script hard-failing npm install).
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CPP_DIR = path.join(__dirname, '..', 'modules', 'vorbis-codec', 'android', 'src', 'main', 'cpp');
const VENDOR_DIR = path.join(CPP_DIR, 'third_party');

// Pinned releases. `dir` is the stable folder name we extract to; `strip` is the
// top-level folder inside the tarball that we rename to `dir`.
const LIBS = [
  { name: 'libogg', version: '1.3.5', url: 'https://downloads.xiph.org/releases/ogg/libogg-1.3.5.tar.gz', strip: 'libogg-1.3.5' },
  { name: 'libvorbis', version: '1.3.7', url: 'https://downloads.xiph.org/releases/vorbis/libvorbis-1.3.7.tar.gz', strip: 'libvorbis-1.3.7' },
];

function vendorOne(lib) {
  const dest = path.join(VENDOR_DIR, lib.name);
  if (fs.existsSync(dest)) {
    console.log(`[vendor-vorbis] ${lib.name} already vendored.`);
    return;
  }
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vorbis-'));
  const tarball = path.join(tmp, `${lib.name}.tar.gz`);
  try {
    console.log(`[vendor-vorbis] downloading ${lib.name} ${lib.version}…`);
    execSync(`curl -fsSL -o "${tarball}" "${lib.url}"`, { stdio: 'inherit' });
    execSync(`tar -xzf "${tarball}" -C "${tmp}"`, { stdio: 'inherit' });
    const extracted = path.join(tmp, lib.strip);
    if (!fs.existsSync(extracted)) {
      console.warn(`[vendor-vorbis] expected ${lib.strip} inside the tarball — Xiph layout may have changed; review vendor-vorbis.js.`);
      return;
    }
    fs.renameSync(extracted, dest);
    // libogg normally generates include/ogg/config_types.h via autoconf. We build
    // with CMake/NDK (no autoconf), so write a stdint-based one (Android always
    // has <stdint.h>) or libogg's headers won't compile.
    if (lib.name === 'libogg') {
      const cfg = path.join(dest, 'include', 'ogg', 'config_types.h');
      fs.writeFileSync(
        cfg,
        [
          '#ifndef __CONFIG_TYPES_H__',
          '#define __CONFIG_TYPES_H__',
          '#include <stdint.h>',
          'typedef int16_t ogg_int16_t;',
          'typedef uint16_t ogg_uint16_t;',
          'typedef int32_t ogg_int32_t;',
          'typedef uint32_t ogg_uint32_t;',
          'typedef int64_t ogg_int64_t;',
          'typedef uint64_t ogg_uint64_t;',
          '#endif',
          '',
        ].join('\n'),
        'utf8',
      );
      console.log('[vendor-vorbis] wrote libogg config_types.h');
    }
    console.log(`[vendor-vorbis] vendored ${lib.name} -> ${path.relative(process.cwd(), dest)}`);
  } catch (e) {
    console.warn(`[vendor-vorbis] failed to vendor ${lib.name}: ${e.message}`);
    console.warn('[vendor-vorbis] the vorbis-codec native build will fail until this succeeds (needs network + curl + tar).');
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  }
}

// Only vendor once the module exists (it's created as part of the Vorbis work);
// otherwise this is a no-op so installs in older checkouts don't warn.
if (!fs.existsSync(path.join(__dirname, '..', 'modules', 'vorbis-codec'))) {
  console.log('[vendor-vorbis] vorbis-codec module not present yet — skipping.');
} else {
  for (const lib of LIBS) vendorOne(lib);
}

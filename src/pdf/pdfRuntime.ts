import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import pdfLibAsset from '../../assets/pdfjs/pdf.min.pdfjsbundle';
import pdfWorkerAsset from '../../assets/pdfjs/pdf.worker.min.pdfjsbundle';
import viewerAsset from '../../assets/pdfjs/viewer.html';

// Stages the bundled pdf.js runtime + viewer.html + the PDF into a file:// dir on
// device (same-origin), so the headless extraction WebView can load them.

// Bump to invalidate the on-device copies when the bundled assets change.
// v11: image extraction. v12: cross-page merge + CJK. v13: pdf.js eval disabled.
const RUNTIME_DIR = 'pdfjs-runtime-v13';

let viewerUriPromise: Promise<string> | null = null;

function runtimeDirectory(): Directory {
  const dir = new Directory(Paths.document, RUNTIME_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

async function copyAssetIfMissing(mod: number, name: string, dir: Directory): Promise<void> {
  const dest = new File(dir, name);
  if (dest.exists) return;
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  new File(asset.localUri ?? asset.uri).copySync(dest);
}

export function ensurePdfRuntime(): Promise<string> {
  if (!viewerUriPromise) {
    viewerUriPromise = (async () => {
      const dir = runtimeDirectory();
      await copyAssetIfMissing(pdfLibAsset, 'pdf.min.mjs', dir);
      await copyAssetIfMissing(pdfWorkerAsset, 'pdf.worker.min.mjs', dir);
      await copyAssetIfMissing(viewerAsset, 'viewer.html', dir);
      return new File(dir, 'viewer.html').uri;
    })().catch((e) => {
      viewerUriPromise = null;
      throw e;
    });
  }
  return viewerUriPromise;
}

export function stagePdf(fileUri: string, docHash: string): string {
  const dir = runtimeDirectory();
  const name = `${docHash}.pdf`;
  const dest = new File(dir, name);
  if (!dest.exists) new File(fileUri).copySync(dest);
  return name;
}

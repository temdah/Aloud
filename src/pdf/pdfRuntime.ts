import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import pdfLibAsset from '../../assets/pdfjs/pdf.min.pdfjsbundle';
import pdfWorkerAsset from '../../assets/pdfjs/pdf.worker.min.pdfjsbundle';
import viewerAsset from '../../assets/pdfjs/viewer.html';

// Bump to invalidate the on-device copies when the bundled assets change.
const RUNTIME_DIR = 'pdfjs-runtime-v9';

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

// Copies pdf.min.mjs + pdf.worker.min.mjs + viewer.html into a runtime dir once,
// returning the viewer.html file:// URI. Cached for the session.
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

// Stages the PDF as a sibling of viewer.html so the page can fetch it
// same-origin; returns the file name to inject as window.PDF_FILE.
export function stagePdf(fileUri: string, docHash: string): string {
  const dir = runtimeDirectory();
  const name = `${docHash}.pdf`;
  const dest = new File(dir, name);
  if (!dest.exists) new File(fileUri).copySync(dest);
  return name;
}

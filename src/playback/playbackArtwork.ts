import { Asset } from 'expo-asset';

let artworkPromise: Promise<string | undefined> | null = null;

// Media3 derives notification colours from the large icon. Resolve the bundled
// artwork once so every playback request shares the same local URI.
export function resolvePlaybackArtworkUrl(): Promise<string | undefined> {
  if (!artworkPromise) {
    artworkPromise = (async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/icon.png'));
        if (!asset.localUri) await asset.downloadAsync();
        return asset.localUri ?? asset.uri;
      } catch {
        return undefined;
      }
    })();
  }
  return artworkPromise;
}

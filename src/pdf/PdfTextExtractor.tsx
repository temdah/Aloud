import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ExtractedBlock, ExtractionMessage } from './pdfExtractionTypes';
import { ensurePdfRuntime, stagePdf } from './pdfRuntime';

// Headless WebView running PDF.js purely to extract text — mounted offscreen but
// still executes JS. Streams pages back (meta → page… → done).

type PdfTextExtractorProps = {
  fileUri: string;
  docHash: string;
  onMeta: (pageCount: number) => void;
  onPage: (page: number, blocks: ExtractedBlock[], textSegment: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
  onStatus?: (stage: string) => void;
};

export function PdfTextExtractor({ fileUri, docHash, onMeta, onPage, onDone, onError, onStatus }: PdfTextExtractorProps) {
  const [setup, setSetup] = useState<{ viewerUri: string; pdfFile: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const viewerUri = await ensurePdfRuntime();
        const pdfFile = stagePdf(fileUri, docHash);
        if (!cancelled) setSetup({ viewerUri, pdfFile });
      } catch (e) {
        if (!cancelled) onError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUri, docHash]);

  if (!setup) return null;

  const handleMessage = (event: WebViewMessageEvent) => {
    let msg: ExtractionMessage;
    try {
      msg = JSON.parse(event.nativeEvent.data) as ExtractionMessage;
    } catch {
      return;
    }
    if (msg.type === 'status') onStatus?.(msg.stage);
    else if (msg.type === 'meta') onMeta(msg.pageCount);
    else if (msg.type === 'page') onPage(msg.page, msg.blocks, msg.textSegment);
    else if (msg.type === 'done') onDone();
    else if (msg.type === 'error') onError(msg.message);
  };

  return (
    <View style={{ position: 'absolute', width: 1, height: 1, left: -1000, top: -1000, opacity: 0 }} pointerEvents="none">
      <WebView
        source={{ uri: setup.viewerUri }}
        originWhitelist={['*']}
        javaScriptEnabled
        allowFileAccess
        allowFileAccessFromFileURLs
        // allowUniversalAccessFromFileURLs dropped (untrusted PDFs); same-file-URL
        // access is enough. If device extraction breaks, restore it.
        injectedJavaScriptBeforeContentLoaded={`window.PDF_FILE=${JSON.stringify(setup.pdfFile)};true;`}
        onMessage={handleMessage}
        // Block any navigation a malicious PDF triggers; only local file:// loads.
        // (XHR/blob module loads aren't navigations, so extraction is unaffected.)
        onShouldStartLoadWithRequest={(req) => req.url.startsWith('file://') || req.url === 'about:blank'}
        onError={(e) => onError(e.nativeEvent.description || 'WebView failed to load')}
        style={{ width: 1, height: 1 }}
      />
    </View>
  );
}

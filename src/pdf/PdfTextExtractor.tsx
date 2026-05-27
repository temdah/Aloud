import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ExtractedDocument, ExtractionMessage } from './pdfExtractionTypes';
import { ensurePdfRuntime, stagePdf } from './pdfRuntime';

type PdfTextExtractorProps = {
  fileUri: string;
  docHash: string;
  onResult: (doc: ExtractedDocument) => void;
  onError: (message: string) => void;
  onStatus?: (stage: string) => void;
};

// Headless WebView that runs PDF.js purely to extract text. Rendered offscreen;
// it executes JS regardless of being invisible. Mount it only while extracting.
export function PdfTextExtractor({ fileUri, docHash, onResult, onError, onStatus }: PdfTextExtractorProps) {
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
    else if (msg.type === 'result') onResult(msg.document);
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
        allowUniversalAccessFromFileURLs
        injectedJavaScriptBeforeContentLoaded={`window.PDF_FILE=${JSON.stringify(setup.pdfFile)};true;`}
        onMessage={handleMessage}
        onError={(e) => onError(e.nativeEvent.description || 'WebView failed to load')}
        style={{ width: 1, height: 1 }}
      />
    </View>
  );
}

// Public API for the PDF text-extraction module (headless PDF.js in a WebView).
export { PdfTextExtractor } from './PdfTextExtractor';
export { ensurePdfRuntime, stagePdf } from './pdfRuntime';
export { deleteExtractedText, loadExtractedText, saveExtractedText } from './extractedTextCache';
export { saveExtractedImage, clearExtractedImages } from './imageStore';
export { estimatePageHeights, loadGeometry, saveGeometry } from './pageGeometry';
export type {
  ExtractedDocument,
  ExtractedBlock,
  ExtractedSentence,
  ExtractionMessage,
} from './pdfExtractionTypes';

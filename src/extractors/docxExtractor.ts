import { strFromU8, unzipSync } from 'fflate';
import { buildDocument, type SourceBlock } from './documentBuilder';
import type { ExtractedDocument } from '../pdf';

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

// Pulls the readable text out of one <w:p> paragraph: every <w:t> run, with
// <w:tab/> and <w:br/> rendered as spaces.
function paragraphText(xml: string): string {
  const out: string[] = [];
  const re = /<w:(t|tab|br)\b([^>]*)>(?:([\s\S]*?)<\/w:\1>)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[1] === 't') out.push(decodeEntities(m[3] ?? ''));
    else out.push(' ');
  }
  return out.join('').replace(/\s+/g, ' ').trim();
}

// docx is a zip; word/document.xml holds the body. We read each <w:p>, mark it a
// heading when its pStyle references a heading style, otherwise a paragraph.
export function extractDocx(bytes: Uint8Array): ExtractedDocument {
  const files = unzipSync(bytes);
  const docXml = files['word/document.xml'];
  if (!docXml) throw new Error('Not a valid Word document (missing document.xml).');
  const xml = strFromU8(docXml);

  const source: SourceBlock[] = [];
  const paraRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = paraRe.exec(xml))) {
    const inner = m[1];
    const text = paragraphText(inner);
    if (!text) continue;
    const style = /<w:pStyle\s+w:val="([^"]*)"/.exec(inner)?.[1] ?? '';
    if (/heading|title/i.test(style)) source.push({ kind: 'h2', text });
    else source.push({ kind: 'p', text });
  }

  return buildDocument(source);
}

import { strFromU8, unzipSync } from 'fflate';
import { buildDocument } from './documentBuilder';
import type { SourceBlock } from './documentBuilderTypes';
import type { ExtractedDocument } from '../pdf';

// docx (a zip of XML) → logical blocks: read each <w:p> in word/document.xml,
// treating heading-styled paragraphs as h2.

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

// Readable text of one <w:p>: each <w:t> run, with tabs/breaks as spaces.
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

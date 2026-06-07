import { buildDocument, type SourceBlock } from './documentBuilder';
import type { ExtractedDocument } from '../pdf';

// Strips inline markdown emphasis/links/code so the spoken + displayed text is
// clean prose. We keep link text, drop the URL.
function stripInline(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → text
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .trim();
}

// Lightweight markdown → logical blocks. Headings become h2; consecutive
// non-blank lines coalesce into a paragraph; list items become their own short
// paragraphs. Fenced code blocks and tables are flattened to plain text.
export function extractMarkdown(raw: string): ExtractedDocument {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const source: SourceBlock[] = [];
  let para: string[] = [];
  let inFence = false;

  const flush = () => {
    if (para.length === 0) return;
    const text = stripInline(para.join(' ').replace(/\s+/g, ' '));
    if (text) source.push({ kind: 'p', text });
    para = [];
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      flush();
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      if (line.trim()) source.push({ kind: 'p', text: line });
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      const text = stripInline(heading[2]);
      if (text) source.push({ kind: 'h2', text });
      continue;
    }

    // Horizontal rule — treat as a paragraph break.
    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      flush();
      continue;
    }

    // List item or blockquote → its own paragraph line.
    const listItem = /^(?:[-*+]\s+|\d+\.\s+|>\s?)(.*)$/.exec(trimmed);
    if (listItem) {
      flush();
      const text = stripInline(listItem[1]);
      if (text) source.push({ kind: 'p', text });
      continue;
    }

    para.push(trimmed);
  }
  flush();

  return buildDocument(source);
}

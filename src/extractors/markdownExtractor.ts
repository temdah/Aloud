import { buildDocument } from './documentBuilder';
import type { SourceBlock } from './documentBuilderTypes';
import type { ExtractedDocument } from '../pdf';

// Lightweight markdown → logical blocks (no full parser): headings become h2,
// consecutive non-blank lines coalesce into paragraphs, list items stand alone,
// and fenced code / tables flatten to plain text.

// Strips inline emphasis/links/code so the text reads cleanly; keeps link text,
// drops the URL.
function stripInline(s: string): string {
  return s
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .trim();
}

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

    // A standalone, short, fully-bold line used as a title (**Title** / __Title__):
    // treat it as a heading so it's spoken with a pause, not run into the body.
    const boldTitle = /^\*\*([^*]+)\*\*$/.exec(trimmed) ?? /^__([^_]+)__$/.exec(trimmed);
    if (boldTitle && para.length === 0) {
      const inner = boldTitle[1].trim();
      if (inner.length > 0 && inner.length <= 60 && !/[.!?]$/.test(inner)) {
        const text = stripInline(inner);
        if (text) source.push({ kind: 'h2', text });
        continue;
      }
    }

    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      flush();
      continue;
    }

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

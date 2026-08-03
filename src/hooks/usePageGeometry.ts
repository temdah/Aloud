import { useCallback, useEffect, useRef, useState } from 'react';
import { estimatePageHeights, loadGeometry, saveGeometry } from '../pdf';
import type { ExtractedBlock } from '../pdf';
import type { PageGeometry } from './usePageGeometryTypes';

// Per-page height/offset table so the reader jumps to any page instantly. Seeded
// from a content estimate, refined by real onLayout heights, cached per doc.
// `version` goes in FlatList extraData so it re-reads getItemLayout on change.

const DEFAULT_PAGE = 560;

export function usePageGeometry(
  docHash: string | undefined,
  blocks: ExtractedBlock[],
  pageCount: number,
  ready: boolean,
): PageGeometry {
  const heightsRef = useRef<number[]>([]);
  const offsetsRef = useRef<number[]>([0]);
  const measuredRef = useRef<boolean[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [version, setVersion] = useState(0);

  const rebuild = () => {
    const h = heightsRef.current;
    const off = new Array(h.length + 1);
    off[0] = 0;
    for (let i = 0; i < h.length; i++) off[i + 1] = off[i] + (h[i] || DEFAULT_PAGE);
    offsetsRef.current = off;
  };

  useEffect(() => {
    if (!docHash || pageCount <= 0) return;
    const cached = loadGeometry(docHash, pageCount);
    if (cached) {
      heightsRef.current = cached.slice();
      measuredRef.current = new Array(pageCount).fill(true);
    } else {
      heightsRef.current = estimatePageHeights(blocks, pageCount);
      measuredRef.current = new Array(pageCount).fill(false);
    }
    rebuild();
    setVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docHash, pageCount]);

  useEffect(() => {
    if (!docHash || pageCount <= 0 || !ready || heightsRef.current.length !== pageCount) return;
    const est = estimatePageHeights(blocks, pageCount);
    const h = heightsRef.current;
    let changed = false;
    for (let i = 0; i < pageCount; i++) {
      if (!measuredRef.current[i] && h[i] !== est[i]) { h[i] = est[i]; changed = true; }
    }
    if (changed) { rebuild(); setVersion((v) => v + 1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pageCount, docHash]);

  const onPageLayout = useCallback(
    (page: number, height: number) => {
      const i = page - 1;
      const h = heightsRef.current;
      if (i < 0 || i >= h.length || height <= 0) return;
      measuredRef.current[i] = true;
      if (Math.abs((h[i] || 0) - height) <= 2) return;
      h[i] = height;
      rebuild();
      setVersion((v) => v + 1);
      if (docHash) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => saveGeometry(docHash, pageCount, heightsRef.current), 1500);
      }
    },
    [docHash, pageCount],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<unknown> | null | undefined, index: number) => ({
      length: heightsRef.current[index] || DEFAULT_PAGE,
      offset: offsetsRef.current[index] ?? DEFAULT_PAGE * index,
      index,
    }),
    [],
  );

  return { getItemLayout, onPageLayout, version };
}

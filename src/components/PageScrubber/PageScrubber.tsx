import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Text, View } from 'react-native';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import { makeStyles } from './PageScrubber.styles';

export type PageScrubberProps = {
  pageCount: number;
  currentPage: number;
  labelForPage?: (page: number) => string;
  onJumpToPage: (page: number) => void;
};

const THUMB_W = 11;
const THUMB_H = 46;
const GHOST_W = 18;
const GHOST_H = 56;

// Page rail with a "ghost" preview: the solid pill stays put while a translucent
// pill follows the finger; on release it glides to the target, then content jumps.
export function PageScrubber({ pageCount, currentPage, labelForPage, onJumpToPage }: PageScrubberProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const viewRef = useRef<View>(null);
  const railHRef = useRef(0);
  const startYRef = useRef(0);
  const startFracRef = useRef(0);
  const dragPageRef = useRef(currentPage);
  const animatingRef = useRef(false);
  const [railH, setRailH] = useState(0);
  const [active, setActive] = useState(false);
  const [dragPage, setDragPage] = useState(currentPage);
  const anchorY = useRef(new Animated.Value(0)).current;

  const fracOf = (page: number) => (pageCount <= 1 ? 0 : (page - 1) / (pageCount - 1));
  const posY = (frac: number, h: number) => frac * Math.max(0, railH - h);

  useEffect(() => {
    if (!active && !animatingRef.current && railH > 0) {
      anchorY.setValue(fracOf(currentPage) * Math.max(0, railH - THUMB_H));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, railH, active]);

  const setDrag = (page: number) => {
    dragPageRef.current = page;
    setDragPage(page);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Capture-phase so the rail intercepts the touch before the list scroll.
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (_e, g) => {
          startYRef.current = g.y0;
          startFracRef.current = fracOf(currentPage);
          setDrag(currentPage);
          setActive(true);
          viewRef.current?.measureInWindow((_x, _y, _w, h) => { if (h) railHRef.current = h; });
        },
        // Relative drag from where the thumb started (no jump to the touch point).
        onPanResponderMove: (_e, g) => {
          const h = railHRef.current;
          if (!h) return;
          const f = Math.max(0, Math.min(1, startFracRef.current + (g.moveY - startYRef.current) / h));
          const page = pageCount <= 1 ? 1 : Math.max(1, Math.min(pageCount, Math.round(f * (pageCount - 1)) + 1));
          setDrag(page);
        },
        onPanResponderRelease: () => {
          setActive(false);
          const target = dragPageRef.current;
          const targetTop = fracOf(target) * Math.max(0, railHRef.current - THUMB_H);
          animatingRef.current = true;
          Animated.timing(anchorY, { toValue: targetTop, duration: 200, useNativeDriver: true }).start(() => {
            animatingRef.current = false;
            onJumpToPage(target);
          });
        },
        onPanResponderTerminate: () => { setActive(false); animatingRef.current = false; },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageCount, currentPage, onJumpToPage, railH],
  );

  const ghostTop = posY(fracOf(dragPage), GHOST_H);

  return (
    <>
      {active ? (
        <View pointerEvents="none" style={styles.bubbleLayer}>
          <View style={[styles.bubble, { top: ghostTop, marginTop: GHOST_H / 2 - 15 }, elevation(3)]}>
            <Text numberOfLines={1} style={ty(TYPE.caption, p.onPrimary)}>{labelForPage ? labelForPage(dragPage) : `Page ${dragPage}`}</Text>
          </View>
        </View>
      ) : null}
      <View
        ref={viewRef}
        onLayout={(e) => { railHRef.current = e.nativeEvent.layout.height; setRailH(e.nativeEvent.layout.height); }}
        {...responder.panHandlers}
        style={styles.track}
        accessibilityRole="adjustable"
      >
        <View style={styles.rail} />
        {active ? (
          <View
            pointerEvents="none"
            style={[styles.ghost, { width: GHOST_W, height: GHOST_H, marginLeft: -GHOST_W / 2, transform: [{ translateY: ghostTop }] }]}
          />
        ) : null}
        <Animated.View
          style={[styles.thumb, { width: THUMB_W, height: THUMB_H, marginLeft: -THUMB_W / 2, transform: [{ translateY: anchorY }] }, elevation(2)]}
        />
      </View>
    </>
  );
}

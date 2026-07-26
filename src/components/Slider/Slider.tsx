import { useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { elevation, useTheme } from '../../theme';
import { makeStyles } from './Slider.styles';

export type SliderProps = {
  value: number;
  min?: number;
  max?: number;
  step?: number | null;
  onChange?: (value: number) => void;
  // When set, the drag is a preview (onChange fires live); do the real work
  // (e.g. seek) here, on release only.
  onCommit?: (value: number) => void;
  ticks?: number[] | null;
  height?: number;
};

// While dragging, the thumb follows the finger (its own drag value) instead of
// the controlled `value`, so a live source (playback position) can't fight it;
// with onCommit the seek is deferred to release for stutter-free scrubbing.
export function Slider({ value, min = 0, max = 1, step = null, onChange, onCommit, ticks = null, height = 36 }: SliderProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const trackRef = useRef<View>(null);
  const widthRef = useRef(0);
  const pageXRef = useRef(0);
  const dragRef = useRef<number | null>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);

  const shown = dragValue != null ? dragValue : value;
  const pct = Math.max(0, Math.min(100, ((shown - min) / (max - min)) * 100));

  const valueAt = (absX: number): number => {
    const w = widthRef.current || 1;
    let v = min + ((absX - pageXRef.current) / w) * (max - min);
    v = Math.max(min, Math.min(max, v));
    if (step) v = Math.round(v / step) * step;
    return v;
  };

  const setDrag = (v: number) => {
    dragRef.current = v;
    setDragValue(v);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (_e, g) => {
          trackRef.current?.measureInWindow((x) => {
            pageXRef.current = x;
            const v = valueAt(g.x0);
            setDrag(v);
            onChange?.(v);
          });
        },
        onPanResponderMove: (_e, g) => {
          const v = valueAt(g.moveX);
          setDrag(v);
          onChange?.(v);
        },
        onPanResponderRelease: () => {
          const v = dragRef.current;
          dragRef.current = null;
          setDragValue(null);
          if (v != null) (onCommit ?? onChange)?.(v);
        },
        onPanResponderTerminate: () => {
          dragRef.current = null;
          setDragValue(null);
        },
      }),
    [min, max, step, onChange, onCommit],
  );

  return (
    <View
      ref={trackRef}
      onLayout={(e) => (widthRef.current = e.nativeEvent.layout.width)}
      {...responder.panHandlers}
      style={[styles.container, { height }]}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: shown }}
    >
      <View style={styles.trackBg} />
      <View style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 4, borderRadius: 2, backgroundColor: p.primary }} />
      {ticks?.map((t, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${((t - min) / (max - min)) * 100}%`,
            width: 2,
            height: 8,
            marginLeft: -1,
            borderRadius: 1,
            backgroundColor: p.borderStrong,
          }}
        />
      ))}
      <View
        style={[
          {
            position: 'absolute',
            left: `${pct}%`,
            width: 20,
            height: 20,
            marginLeft: -10,
            borderRadius: 10,
            backgroundColor: p.primary,
            borderWidth: 3,
            borderColor: p.background,
          },
          elevation(2),
        ]}
      />
    </View>
  );
}

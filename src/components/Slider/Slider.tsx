import { useMemo, useRef } from 'react';
import { PanResponder, View } from 'react-native';
import { elevation, useTheme } from '../../theme';
import { makeStyles } from './Slider.styles';

export type SliderProps = {
  value: number;
  min?: number;
  max?: number;
  step?: number | null;
  onChange?: (value: number) => void;
  ticks?: number[] | null;
  height?: number;
};

// Gesture math identical to the design; only the event source changes (web
// PointerEvents -> RN PanResponder + measureInWindow).
export function Slider({ value, min = 0, max = 1, step = null, onChange, ticks = null, height = 36 }: SliderProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const trackRef = useRef<View>(null);
  const widthRef = useRef(0);
  const pageXRef = useRef(0);

  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const emit = (absX: number) => {
    const w = widthRef.current;
    if (!w) return;
    let v = min + ((absX - pageXRef.current) / w) * (max - min);
    v = Math.max(min, Math.min(max, v));
    if (step) v = Math.round(v / step) * step;
    onChange?.(v);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (_e, g) => {
          trackRef.current?.measureInWindow((x) => {
            pageXRef.current = x;
            emit(g.x0);
          });
        },
        onPanResponderMove: (_e, g) => emit(g.moveX),
      }),
    // emit closes over current props via refs; recreate when bounds change
    [min, max, step, onChange],
  );

  return (
    <View
      ref={trackRef}
      onLayout={(e) => (widthRef.current = e.nativeEvent.layout.width)}
      {...responder.panHandlers}
      style={[styles.container, { height }]}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}
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

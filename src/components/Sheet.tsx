import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, Text, View } from 'react-native';
import { elevation, RADIUS, ty, TYPE, useTheme } from '../theme';
import type { SheetProps } from './componentTypes';
import { IconButton } from './IconButton';

// Bottom sheet via RN Modal + Animated (minimal-footprint substitute for
// @gorhom/bottom-sheet, which needs reanimated/New Arch). Tap backdrop to close.
export function Sheet({ open, onClose, title, children, heightRatio = 0.7 }: SheetProps) {
  const { palette: p } = useTheme();
  const screenH = Dimensions.get('window').height;
  const sheetH = Math.round(screenH * heightRatio);
  const translateY = useRef(new Animated.Value(sheetH)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: open ? 0 : sheetH, duration: 280, easing: Easing.bezier(0.2, 0.7, 0.3, 1), useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: open ? 1 : 0, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, [open, sheetH, translateY, backdrop]);

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={{ ...StyleAbsoluteFill, backgroundColor: '#000', opacity: backdrop.interpolate({ inputRange: [0, 1], outputRange: [0, 0.32] }) }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={[
            {
              height: sheetH,
              backgroundColor: p.surface,
              borderTopLeftRadius: RADIUS.xl,
              borderTopRightRadius: RADIUS.xl,
              transform: [{ translateY }],
            },
            elevation(4),
          ]}
        >
          <View style={{ paddingTop: 12, paddingBottom: 4, alignItems: 'center' }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: p.borderStrong }} />
          </View>
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingLeft: 20, paddingRight: 8 }}>
              <Text style={[ty(TYPE.title, p.text), { flex: 1 }]}>{title}</Text>
              {onClose ? <IconButton icon="close" onPress={onClose} accessibilityLabel="Close" /> : null}
            </View>
          ) : null}
          <View style={{ flex: 1 }}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const StyleAbsoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

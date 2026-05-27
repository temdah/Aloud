import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, Text, View } from 'react-native';
import { ty, TYPE, useTheme } from '../../theme';
import { IconButton } from '../IconButton';
import { makeStyles } from './Sheet.styles';

export type SheetProps = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  heightRatio?: number;
};

// Bottom sheet via RN Modal + Animated (minimal-footprint substitute for
// @gorhom/bottom-sheet, which needs reanimated/New Arch). Tap backdrop to close.
export function Sheet({ open, onClose, title, children, heightRatio = 0.7 }: SheetProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
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
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop.interpolate({ inputRange: [0, 1], outputRange: [0, 0.32] }) }]}>
          <Pressable style={styles.backdropPress} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetH,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.grabberWrap}>
            <View style={styles.grabber} />
          </View>
          {title ? (
            <View style={styles.titleRow}>
              <Text style={[ty(TYPE.title, p.text), styles.title]}>{title}</Text>
              {onClose ? <IconButton icon="close" onPress={onClose} accessibilityLabel="Close" /> : null}
            </View>
          ) : null}
          <View style={styles.body}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

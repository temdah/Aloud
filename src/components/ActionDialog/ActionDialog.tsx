import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { elevation, ty, TYPE, useTheme } from '../../theme';
import { Button } from '../Button';
import type { ButtonVariant } from '../Button';
import { makeStyles } from './ActionDialog.styles';

export type DialogAction = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
};

export type ActionDialogProps = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  message?: string;
  actions: DialogAction[];
};

// Themed centered dialog (the app's Alert substitute). Rendered as an in-tree
// overlay, not a Modal, so expo-blur can sample the content behind it (BlurView
// can't blur across a Modal's separate native window on Android). Mount at a
// screen root; auto-closes after an action.
export function ActionDialog({ open, onClose, title, message, actions }: ActionDialogProps) {
  const { palette: p, mode } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: open ? 220 : 150,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, anim]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose?.();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  if (!mounted) return null;

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const run = (action: DialogAction) => {
    action.onPress?.();
    onClose?.();
  };

  return (
    <View style={styles.overlay}>
      {/* Keep the BlurView out of any opacity-animated layer: a native-driven
          opacity animation composites its parent onto a separate layer, and the
          blur would then sample nothing. Fade a plain scrim instead. */}
      <BlurView
        intensity={48}
        tint={mode === 'dark' ? 'dark' : 'light'}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, elevation(3), { opacity: anim, transform: [{ scale }] }]}>
          {title ? <Text style={[ty(TYPE.title, p.text), styles.title]}>{title}</Text> : null}
          {message ? <Text style={[ty(TYPE.bodySmall, p.textMuted), styles.message]}>{message}</Text> : null}
          <View style={styles.actions}>
            {actions.map((a, i) => (
              <Button key={i} label={a.label} variant={a.variant ?? 'tonal'} full onPress={() => run(a)} />
            ))}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

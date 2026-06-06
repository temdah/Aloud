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
  /** One-line context: what happened / why this dialog appeared. */
  message?: string;
  actions: DialogAction[];
};

// Themed centered dialog (Animated + blurred backdrop) — the app's substitute
// for the native Alert. Rendered as an in-tree overlay rather than a Modal so
// expo-blur can actually blur the content behind it (BlurView can't sample
// across a Modal's separate native window on Android). Mount it at a screen
// root so it covers the whole screen. Auto-closes after an action.
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
      {/* The BlurView must NOT be nested inside an opacity-animated layer:
          dimezisBlurView samples the window content behind it, and a
          native-driven opacity animation forces its parent onto a separate
          composited layer, so the blur would sample nothing. Keep the blur
          mounted with the overlay and fade a plain scrim instead. */}
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

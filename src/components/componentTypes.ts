import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { ElevationLevel } from '../theme';

export type IconName =
  | 'play' | 'pause' | 'skipBack' | 'skipFwd' | 'back' | 'more' | 'plus'
  | 'check' | 'search' | 'book' | 'speed' | 'voice' | 'settings' | 'download'
  | 'import' | 'highlight' | 'sun' | 'moon' | 'close' | 'chevR' | 'wave' | 'trash';

export type IconProps = { name: IconName | string; size?: number; color?: string; stroke?: number };

export type SpinnerProps = { size?: number; color?: string };

export type ButtonVariant = 'filled' | 'tonal' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonProps = {
  label?: string;
  icon?: IconName;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
};

export type IconButtonProps = {
  icon: IconName;
  onPress?: () => void;
  size?: number;
  variant?: 'ghost' | 'tonal';
  selected?: boolean;
  accessibilityLabel?: string;
};

export type AppBarProps = {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
  transparent?: boolean;
};

export type CardProps = {
  children: ReactNode;
  padding?: number;
  elevation?: ElevationLevel;
  style?: StyleProp<ViewStyle>;
};

export type ListItemProps = {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  divider?: boolean;
};

export type SliderProps = {
  value: number;
  min?: number;
  max?: number;
  step?: number | null;
  onChange?: (value: number) => void;
  ticks?: number[] | null;
  height?: number;
};

export type ProgressBarProps = {
  value?: number;
  indeterminate?: boolean;
  height?: number;
  color?: string | null;
};

export type ChipProps = {
  label: string;
  selected?: boolean;
  icon?: IconName;
  onPress?: () => void;
};

export type SheetProps = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  heightRatio?: number;
};

export type PlayerControlsProps = {
  playing: boolean;
  onTogglePlay: () => void;
  onSkipBack: () => void;
  onSkipFwd: () => void;
  progress: number;
  onScrub: (value: number) => void;
  position: string;
  duration: string;
  speed: number;
  onSpeed: () => void;
  voiceName: string;
};

export type CoverThumbProps = { idx?: number; width?: number; height?: number };

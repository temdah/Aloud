import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme';
import type { IconProps } from './componentTypes';

// Minimal 24px stroke/fill icon set. Ported 1:1 from the design's <svg> paths.
export function Icon({ name, size = 24, color, stroke = 1.75 }: IconProps) {
  const { palette } = useTheme();
  const c = color ?? palette.text;
  const line = { fill: 'none', stroke: c, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  const body = () => {
    switch (name) {
      case 'play': return <Path d="M7 5l12 7-12 7V5z" fill={c} />;
      case 'pause': return <><Rect x="6" y="5" width="4" height="14" rx="1" fill={c} /><Rect x="14" y="5" width="4" height="14" rx="1" fill={c} /></>;
      case 'skipBack': return <Path d="M11 6l-7 6 7 6V6z M20 6l-7 6 7 6V6z" fill={c} />;
      case 'skipFwd': return <Path d="M13 6l7 6-7 6V6z M4 6l7 6-7 6V6z" fill={c} />;
      case 'back': return <Path d="M15 18l-6-6 6-6" {...line} />;
      case 'more': return <><Circle cx="5" cy="12" r="1.5" fill={c} /><Circle cx="12" cy="12" r="1.5" fill={c} /><Circle cx="19" cy="12" r="1.5" fill={c} /></>;
      case 'plus': return <Path d="M12 5v14M5 12h14" {...line} />;
      case 'check': return <Path d="M4 12l5 5L20 6" {...line} />;
      case 'search': return <><Circle cx="11" cy="11" r="6" {...line} /><Path d="M20 20l-4-4" {...line} /></>;
      case 'book': return <Path d="M4 5a2 2 0 012-2h13v18H6a2 2 0 01-2-2V5z M4 17a2 2 0 012-2h13" {...line} />;
      case 'speed': return <><Path d="M4 14a8 8 0 1116 0M12 14l4-5" {...line} /><Circle cx="12" cy="14" r="1.5" fill={c} /></>;
      case 'voice': return <><Rect x="9" y="3" width="6" height="12" rx="3" {...line} /><Path d="M5 11a7 7 0 0014 0M12 18v3" {...line} /></>;
      case 'settings': return <><Circle cx="12" cy="12" r="3" {...line} /><Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06A2 2 0 113.5 16.96l.06-.06A1.65 1.65 0 003.9 15a1.65 1.65 0 00-1.51-1H2a2 2 0 110-4h.09A1.65 1.65 0 003.9 9a1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 116.34 4.3l.06.06A1.65 1.65 0 008.21 4.7 1.65 1.65 0 009.2 3.19V3a2 2 0 014 0v.09c0 .67.4 1.27 1 1.51.6.25 1.3.11 1.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.31 9c.25.6.85 1 1.51 1H21a2 2 0 110 4h-.09c-.67 0-1.27.4-1.51 1z" {...line} /></>;
      case 'download': return <Path d="M12 4v12m-5-5l5 5 5-5M5 20h14" {...line} />;
      case 'import': return <Path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z M14 3v5h5M12 18v-7m-3 3l3-3 3 3" {...line} />;
      case 'highlight': return <Path d="M9 11l4 4 8-8-4-4-8 8z M9 11l-3 7 7-3" {...line} />;
      case 'sun': return <><Circle cx="12" cy="12" r="4" {...line} /><Path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" {...line} /></>;
      case 'moon': return <Path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" {...line} />;
      case 'close': return <Path d="M6 6l12 12M6 18L18 6" {...line} />;
      case 'chevR': return <Path d="M9 6l6 6-6 6" {...line} />;
      case 'wave': return <Path d="M4 12h2M8 8v8M11 5v14M14 9v6M17 7v10M20 11v2" {...line} />;
      case 'trash': return <Path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" {...line} />;
      default: return <Rect x="4" y="4" width="16" height="16" rx="2" {...line} />;
    }
  };

  return <Svg width={size} height={size} viewBox="0 0 24 24">{body()}</Svg>;
}

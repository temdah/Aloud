import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { languageLabel } from '../../supertonic';
import { ty, TYPE, useTheme } from '../../theme';
import { Icon } from '../Icon';
import { makeStyles } from './LanguagePicker.styles';

export type LanguagePickerProps = {
  value: string | null; // null = follow app default
  onChange: (code: string) => void;
  langCodes: readonly string[];
  onUseDefault?: () => void; // when set, shows a "Use app default" row that clears the override
  defaultLabel?: string;
};

// Scrollable language list, gated to the active model's supported languages.
// Used for the global default (Settings) and per-document overrides (reader).
export function LanguagePicker({ value, onChange, langCodes, onUseDefault, defaultLabel }: LanguagePickerProps) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const codes = useMemo(() => [...langCodes].sort((a, b) => languageLabel(a).localeCompare(languageLabel(b))), [langCodes]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 8 }}>
        <View style={styles.card}>
          {onUseDefault ? (
            <Pressable
              onPress={onUseDefault}
              accessibilityRole="button"
              accessibilityState={{ selected: value === null }}
              style={[styles.rowBase, { backgroundColor: value === null ? p.primarySoft : 'transparent', borderBottomWidth: 1 }]}
            >
              <View style={styles.rowBody}>
                <Text style={ty(TYPE.bodyMedium, p.text)}>Use app default</Text>
                {defaultLabel ? <Text style={ty(TYPE.bodySmall, p.textMuted)}>{defaultLabel}</Text> : null}
              </View>
              {value === null ? <Icon name="check" size={20} color={p.primary} /> : null}
            </Pressable>
          ) : null}
          {codes.map((code, i) => (
            <Pressable
              key={code}
              onPress={() => onChange(code)}
              accessibilityRole="button"
              accessibilityState={{ selected: value === code }}
              style={[
                styles.rowBase,
                {
                  backgroundColor: value === code ? p.primarySoft : 'transparent',
                  borderBottomWidth: i === codes.length - 1 ? 0 : 1,
                },
              ]}
            >
              <View style={styles.rowBody}>
                <Text style={ty(TYPE.bodyMedium, p.text)}>{languageLabel(code)}</Text>
                <Text style={ty(TYPE.bodySmall, p.textMuted)}>{code}</Text>
              </View>
              {value === code ? <Icon name="check" size={20} color={p.primary} /> : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <Text style={[ty(TYPE.caption, p.textDim), styles.footnote]}>
        Languages available depend on the chosen voice model
      </Text>
    </View>
  );
}

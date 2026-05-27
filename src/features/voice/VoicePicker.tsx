import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RADIUS, ty, TYPE, useTheme } from '../../theme';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { VOICES } from './voiceCatalog';
import { VoiceSwatch } from './VoiceSwatch';

type VoicePickerProps = { value: string; onChange: (id: string) => void };
type GenderFilter = 'all' | 'f' | 'm';

// Body of the voice-picker sheet: gender filter + selectable voice list with
// preview play. Reusable from Settings (and anywhere a voice is chosen).
export function VoicePicker({ value, onChange }: VoicePickerProps) {
  const { palette: p } = useTheme();
  const [gender, setGender] = useState<GenderFilter>('all');
  const [previewing, setPreviewing] = useState<string | null>(null);

  const filtered = VOICES.filter((v) => gender === 'all' || v.gender === gender);

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
        <Chip label="All" selected={gender === 'all'} onPress={() => setGender('all')} />
        <Chip label="Female" selected={gender === 'f'} onPress={() => setGender('f')} />
        <Chip label="Male" selected={gender === 'm'} onPress={() => setGender('m')} />
      </View>
      <View style={{ backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: RADIUS.md, overflow: 'hidden' }}>
        {filtered.map((v, i) => (
          <Pressable
            key={v.id}
            onPress={() => onChange(v.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === v.id }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: value === v.id ? p.primarySoft : 'transparent', borderBottomWidth: i === filtered.length - 1 ? 0 : 1, borderBottomColor: p.border }}
          >
            <VoiceSwatch idx={parseInt(v.id.slice(1), 10) - 1} gender={v.gender} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={ty(TYPE.bodyMedium, p.text)}>{v.label}</Text>
              <Text style={ty(TYPE.bodySmall, p.textMuted)}>{v.id}</Text>
            </View>
            <Pressable
              onPress={() => setPreviewing((cur) => (cur === v.id ? null : v.id))}
              accessibilityRole="button"
              accessibilityLabel={`Preview ${v.label}`}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: previewing === v.id ? p.primary : p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name={previewing === v.id ? 'pause' : 'play'} size={14} color={previewing === v.id ? p.onPrimary : p.text} />
            </Pressable>
            {value === v.id ? <Icon name="check" size={20} color={p.primary} /> : null}
          </Pressable>
        ))}
      </View>
      <Text style={[ty(TYPE.caption, p.textDim), { marginTop: 12, textAlign: 'center' }]}>
        Voices run locally · no audio leaves the device
      </Text>
    </View>
  );
}

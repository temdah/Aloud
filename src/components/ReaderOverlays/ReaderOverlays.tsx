import { useMemo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { findModel, languageLabel } from '../../supertonic';
import { ty, TYPE, useTheme } from '../../theme';
import { ActionDialog, type DialogAction } from '../ActionDialog';
import { Chip } from '../Chip';
import { LanguagePicker } from '../LanguagePicker';
import { ManageCacheSheet } from '../ManageCacheSheet';
import { Sheet } from '../Sheet';
import { Slider } from '../Slider';
import { VoicePicker, voiceLabel } from '../VoicePicker';
import { makeStyles } from './ReaderOverlays.styles';

const SPEED_PRESETS = [0.9, 1, 1.05, 1.15, 1.25, 1.5];

type ReaderOverlaysProps = {
  speedOpen: boolean;
  speed: number;
  onCloseSpeed: () => void;
  onChangeSpeed: (speed: number) => void;
  voiceOpen: boolean;
  voiceId: string;
  modelId: string | null;
  language: string;
  onCloseVoice: () => void;
  onChangeVoice: (voiceId: string) => void;
  languageOpen: boolean;
  documentLanguage: string | null;
  defaultLanguage: string;
  onCloseLanguage: () => void;
  onChangeLanguage: (language: string) => void;
  onUseDefaultLanguage: () => void;
  cacheOpen: boolean;
  documentHash: string | null;
  documentTitle?: string;
  onCloseCache: () => void;
  pendingVoice: string | null;
  onClosePendingVoice: () => void;
  onApplyPendingVoice: (voiceId: string) => void;
  contentsPrompt: { title: string } | null;
  contentsActions: DialogAction[];
  onCloseContents: () => void;
  playPromptOpen: boolean;
  pendingOffset: number | null;
  onClosePlayPrompt: () => void;
  onPlayFrom: (offset: number) => void;
  menuOpen: boolean;
  menuActions: DialogAction[];
  onCloseMenu: () => void;
  playbackError: string | null;
  onRetryPlayback: () => void;
  onStopPlayback: () => void;
  modelErrorOpen: boolean;
  onCloseModelError: () => void;
  onRedownloadModel: () => void;
  sleepOpen: boolean;
  sleepActive: boolean;
  sleepMinutesLeft: number;
  sleepActions: DialogAction[];
  onCloseSleep: () => void;
  extractor: ReactNode;
};

export function ReaderOverlays({
  speedOpen,
  speed,
  onCloseSpeed,
  onChangeSpeed,
  voiceOpen,
  voiceId,
  modelId,
  language,
  onCloseVoice,
  onChangeVoice,
  languageOpen,
  documentLanguage,
  defaultLanguage,
  onCloseLanguage,
  onChangeLanguage,
  onUseDefaultLanguage,
  cacheOpen,
  documentHash,
  documentTitle,
  onCloseCache,
  pendingVoice,
  onClosePendingVoice,
  onApplyPendingVoice,
  contentsPrompt,
  contentsActions,
  onCloseContents,
  playPromptOpen,
  pendingOffset,
  onClosePlayPrompt,
  onPlayFrom,
  menuOpen,
  menuActions,
  onCloseMenu,
  playbackError,
  onRetryPlayback,
  onStopPlayback,
  modelErrorOpen,
  onCloseModelError,
  onRedownloadModel,
  sleepOpen,
  sleepActive,
  sleepMinutesLeft,
  sleepActions,
  onCloseSleep,
  extractor,
}: ReaderOverlaysProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  return (
    <>
      <Sheet open={speedOpen} onClose={onCloseSpeed} title="Playback speed" heightRatio={0.42}>
        <View style={styles.sheetBody}>
          <Text style={[ty(TYPE.display, palette.text), styles.speedValue]}>×{speed.toFixed(2)}</Text>
          <Slider value={speed} min={0.9} max={1.5} step={0.05} onChange={onChangeSpeed} ticks={[0.9, 1, 1.05, 1.25, 1.5]} />
          <View style={styles.sliderLabels}>
            <Text style={ty(TYPE.mono, palette.textMuted)}>0.90</Text>
            <Text style={ty(TYPE.mono, palette.textMuted)}>1.50</Text>
          </View>
          <View style={styles.presetRow}>
            {SPEED_PRESETS.map((value) => (
              <Chip key={value} label={`×${value.toFixed(2)}`} selected={Math.abs(speed - value) < 0.01} onPress={() => onChangeSpeed(value)} />
            ))}
          </View>
        </View>
      </Sheet>

      <Sheet open={voiceOpen} onClose={onCloseVoice} title="Reading voice" heightRatio={0.78}>
        <VoicePicker value={voiceId} onChange={onChangeVoice} modelId={modelId} lang={language} />
      </Sheet>

      <Sheet open={languageOpen} onClose={onCloseLanguage} title="Language" heightRatio={0.78}>
        <LanguagePicker
          value={documentLanguage}
          onChange={onChangeLanguage}
          onUseDefault={onUseDefaultLanguage}
          defaultLabel={languageLabel(defaultLanguage)}
          langCodes={findModel(modelId)?.langCodes ?? []}
        />
      </Sheet>

      <ManageCacheSheet open={cacheOpen} onClose={onCloseCache} docHash={documentHash} title={documentTitle} />

      <ActionDialog
        open={pendingVoice != null}
        onClose={onClosePendingVoice}
        title="Change voice?"
        message={pendingVoice ? `This document already has audio cached for ${voiceLabel(voiceId)}. That cache is kept but won't be used — new audio is generated with ${voiceLabel(pendingVoice)} as you play.` : undefined}
        actions={[
          { label: pendingVoice ? `Use ${voiceLabel(pendingVoice)}` : 'Change', variant: 'filled', onPress: () => { if (pendingVoice) onApplyPendingVoice(pendingVoice); } },
          { label: 'Keep current voice', variant: 'ghost' },
        ]}
      />

      <ActionDialog
        open={contentsPrompt != null}
        onClose={onCloseContents}
        title={contentsPrompt?.title}
        message="This is a contents entry. Jump to its section, or select the text to read from here."
        actions={contentsActions}
      />

      <ActionDialog
        open={playPromptOpen}
        onClose={onClosePlayPrompt}
        title="Jump here?"
        message="Audio is still playing. Start reading from the tapped sentence, or keep playing where you are."
        actions={[
          { label: 'Play from here', variant: 'filled', onPress: () => { if (pendingOffset != null) onPlayFrom(pendingOffset); } },
          { label: 'Keep playing', variant: 'ghost' },
        ]}
      />

      <ActionDialog open={menuOpen} onClose={onCloseMenu} title={documentTitle} actions={menuActions} />

      <ActionDialog
        open={playbackError != null}
        title="Playback stopped"
        message={playbackError ?? undefined}
        actions={[
          { label: 'Rebuild and retry', variant: 'filled', onPress: onRetryPlayback },
          { label: 'Stop playback', variant: 'ghost', onPress: onStopPlayback },
        ]}
      />

      <ActionDialog
        open={modelErrorOpen}
        onClose={onCloseModelError}
        title="Voice model looks damaged"
        message="The voice model couldn’t load — its files may be incomplete. Re-download it to fix reading aloud."
        actions={[
          { label: 'Re-download', variant: 'filled', onPress: onRedownloadModel },
          { label: 'Not now', variant: 'ghost' },
        ]}
      />

      <ActionDialog
        open={sleepOpen}
        onClose={onCloseSleep}
        title="Sleep timer"
        message={sleepActive ? `Pausing in about ${sleepMinutesLeft} min.` : 'Pause playback after…'}
        actions={sleepActions}
      />

      {extractor}
    </>
  );
}

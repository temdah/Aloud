import { usePlaybackContext } from '../../playback';
import { documentToBook } from '../../utils';
import { NowPlayingPill } from '../NowPlayingPill';

export type MiniPlayerProps = {
  /** Hide on screens that have their own full transport (the Reader). */
  hidden?: boolean;
  /** Open the Reader for the playing document when the pill is tapped. */
  onOpen: (docId: string) => void;
};

// App-wide "now playing" bar. Renders nothing until a document is engaged, then
// floats above whatever screen is showing so the user keeps transport control
// after leaving the Reader. Driven entirely by the global playback context.
export function MiniPlayer({ hidden = false, onOpen }: MiniPlayerProps) {
  const { playback, activeDoc } = usePlaybackContext();

  // Gate on `started` (audio has actually played), not `engaged` (which is also
  // true for a mere text selection) — otherwise the bar shows with no audio.
  if (hidden || !activeDoc || !playback.started) return null;

  const book = documentToBook(activeDoc.doc);
  return (
    <NowPlayingPill
      book={book}
      playing={playback.playing}
      onPress={() => onOpen(activeDoc.doc.docHash)}
      onToggle={playback.toggle}
    />
  );
}

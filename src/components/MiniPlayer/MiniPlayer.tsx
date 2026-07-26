import { usePlaybackContext } from '../../playback';
import { documentToBook } from '../../utils';
import { NowPlayingPill } from '../NowPlayingPill';

export type MiniPlayerProps = {
  hidden?: boolean;
  onOpen: (docId: string) => void;
};

// App-wide "now playing" bar; floats above every screen so transport survives
// leaving the Reader. Driven by the global playback context.
export function MiniPlayer({ hidden = false, onOpen }: MiniPlayerProps) {
  const { playback, activeDoc, clearActiveDoc } = usePlaybackContext();

  // Gate on `started` (audio actually played), not `engaged` (also true for a
  // text selection). `halt` keeps it true, so square-stop leaves the bar; only a
  // swipe-dismiss removes it.
  if (hidden || !activeDoc || !playback.started) return null;

  const book = documentToBook(activeDoc.doc);
  return (
    <NowPlayingPill
      book={book}
      playing={playback.playing}
      onPress={() => onOpen(activeDoc.doc.docHash)}
      onToggle={playback.toggle}
      onStop={playback.halt}
      onDismiss={() => {
        playback.stop();
        clearActiveDoc();
      }}
    />
  );
}

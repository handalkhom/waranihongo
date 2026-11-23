import type { ReactElement } from 'react';
import { Volume2 } from 'lucide-react';
import type { KanaItem } from '@wara/content/schema';
import { useSpeech } from '@/hooks/useSpeech';

export type KanaIntroCardProps = {
  readonly item: KanaItem;
  readonly onDone: () => void;
};

const JAPANESE_RUN = /([\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]+)/u;

export function KanaIntroCard({ item, onDone }: KanaIntroCardProps): ReactElement {
  const speak = useSpeech();
  const { char, romaji, mnemonic } = item.data;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-xs font-medium text-accent-foreground">Huruf baru</p>
      <div className="flex flex-col items-center gap-2">
        <div className="genko flex size-40 items-center justify-center">
          <span lang="ja" className="text-8xl leading-none">
            {char}
          </span>
        </div>
        <span className="text-lg text-muted-foreground">{romaji}</span>
      </div>
      {mnemonic !== undefined && (
        <p className="max-w-xs text-center text-sm">
          {mnemonic.split(JAPANESE_RUN).map((part, index) =>
            index % 2 === 1 ? (
              <span key={index} lang="ja">
                {part}
              </span>
            ) : (
              part
            ),
          )}
        </p>
      )}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            speak(char);
          }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9"
        >
          <Volume2 aria-hidden="true" className="size-4" />
          Dengar
        </button>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9"
        >
          Mengerti
        </button>
      </div>
    </div>
  );
}

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
      <p className="text-sm text-muted-foreground">Huruf baru</p>
      <div className="flex flex-col items-center gap-2">
        <span lang="ja" className="text-7xl font-medium leading-none">
          {char}
        </span>
        <span className="text-xl text-muted-foreground">{romaji}</span>
      </div>
      {mnemonic !== undefined && (
        <p className="text-sm">
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
      <button
        type="button"
        onClick={() => {
          speak(char);
        }}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9"
      >
        <Volume2 aria-hidden="true" className="size-4" />
        Dengar
      </button>
      <button
        type="button"
        onClick={onDone}
        className="h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9"
      >
        Mengerti
      </button>
    </div>
  );
}

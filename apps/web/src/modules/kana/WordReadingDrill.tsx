import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { romajiMatches, romanize } from '@wara/core';
import type { KanaData, VocabItem } from '@wara/content/schema';
import { DrillFeedback } from '@/components/DrillFeedback';
import type { KanaDrillAnswer } from './types';

export type WordReadingDrillProps = {
  readonly item: VocabItem;
  readonly kana: ReadonlyArray<KanaData>;
  readonly onAnswer: (answer: KanaDrillAnswer) => void;
};

type Answered = Omit<KanaDrillAnswer, 'itemId'>;

export function WordReadingDrill({ item, kana, onAnswer }: WordReadingDrillProps): ReactElement {
  const inputId = useId();
  const startedAt = useRef(0);
  const [text, setText] = useState('');
  const [answered, setAnswered] = useState<Answered | null>(null);
  const locked = answered !== null;
  const blank = text.trim() === '';

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">Baca kata ini</p>
        <p lang="ja" className="genko inline-flex px-4 py-3 text-5xl font-medium leading-tight">
          {item.data.word}
        </p>
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (locked || blank) return;
          setAnswered({
            correct: romajiMatches({ reading: item.data.reading, given: text, kana }),
            given: { mode: 'typed', text },
            elapsedMs: Date.now() - startedAt.current,
          });
        }}
      >
        <label htmlFor={inputId} className="text-sm font-medium">
          Romaji
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            type="text"
            value={text}
            readOnly={locked}
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => {
              setText(event.target.value);
            }}
            className="h-11 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 read-only:opacity-70 md:h-9 md:text-sm"
          />
          <button
            type="submit"
            disabled={locked || blank}
            className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 md:h-9"
          >
            Kirim
          </button>
        </div>
      </form>
      {answered !== null && (
        <DrillFeedback
          correct={answered.correct}
          answer={romanize({ reading: item.data.reading, kana })}
          onContinue={() => {
            onAnswer({ itemId: item.id, ...answered });
          }}
        />
      )}
    </div>
  );
}

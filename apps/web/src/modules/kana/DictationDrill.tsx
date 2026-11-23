import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Volume2 } from 'lucide-react';
import type { KanaItem } from '@wara/content/schema';
import { DrillFeedback } from '@/components/DrillFeedback';
import { useSpeech } from '@/hooks/useSpeech';
import type { KanaDrillAnswer } from './types';

export type DictationDrillProps = {
  readonly item: KanaItem;
  readonly choices: ReadonlyArray<KanaItem>;
  readonly onAnswer: (answer: KanaDrillAnswer) => void;
};

type ChosenAnswer = {
  readonly chosen: KanaItem;
  readonly elapsedMs: number;
};

export function DictationDrill({ item, choices, onAnswer }: DictationDrillProps): ReactElement {
  const speak = useSpeech();
  const startedAt = useRef(0);
  const [pick, setPick] = useState<ChosenAnswer | null>(null);
  const char = item.data.char;

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    speak(char);
  }, [char, speak]);

  const correct = pick !== null && pick.chosen.id === item.id;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Dengarkan, lalu pilih hurufnya</p>
      <button
        type="button"
        onClick={() => {
          speak(char);
        }}
        className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9"
      >
        <Volume2 aria-hidden="true" className="size-4" />
        Putar lagi
      </button>
      <div className="grid grid-cols-3 gap-2">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            disabled={pick !== null}
            onClick={() => {
              setPick({ chosen: choice, elapsedMs: Date.now() - startedAt.current });
            }}
            className="genko flex aspect-square min-h-14 items-center justify-center hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
          >
            <span lang="ja" className="text-5xl leading-none">
              {choice.data.char}
            </span>
          </button>
        ))}
      </div>
      {pick !== null && (
        <DrillFeedback
          correct={correct}
          answer={<span lang="ja">{char}</span>}
          onContinue={() => {
            onAnswer({
              itemId: item.id,
              correct,
              given: { mode: 'choice', itemId: pick.chosen.id },
              elapsedMs: pick.elapsedMs,
            });
          }}
        />
      )}
    </div>
  );
}

import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { KanaItem } from '@wara/content/schema';
import { DrillFeedback } from '@/components/DrillFeedback';
import type { KanaDrillAnswer } from './types';

export type RomajiToKanaDrillProps = {
  readonly item: KanaItem;
  readonly choices: ReadonlyArray<KanaItem>;
  readonly onAnswer: (answer: KanaDrillAnswer) => void;
};

type ChoicePick = {
  readonly chosen: KanaItem;
  readonly elapsedMs: number;
};

export function RomajiToKanaDrill({ item, choices, onAnswer }: RomajiToKanaDrillProps): ReactElement {
  const start = useRef(0);
  const [pick, setPick] = useState<ChoicePick | null>(null);

  useEffect(() => {
    start.current = Date.now();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Pilih huruf untuk bunyi ini</p>
      <p className="text-4xl font-semibold">{item.data.romaji}</p>
      <div className="grid grid-cols-3 gap-2">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            disabled={pick !== null}
            onClick={() => {
              setPick({ chosen: choice, elapsedMs: Date.now() - start.current });
            }}
            className="h-20 rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
          >
            <span lang="ja" className="text-5xl">
              {choice.data.char}
            </span>
          </button>
        ))}
      </div>
      {pick !== null && (
        <DrillFeedback
          correct={pick.chosen.id === item.id}
          answer={<span lang="ja">{item.data.char}</span>}
          onContinue={() => {
            onAnswer({
              itemId: item.id,
              correct: pick.chosen.id === item.id,
              given: { mode: 'choice', itemId: pick.chosen.id },
              elapsedMs: pick.elapsedMs,
            });
          }}
        />
      )}
    </div>
  );
}

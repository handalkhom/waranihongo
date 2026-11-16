import { useState, type ReactElement } from 'react';
import type { KanaItem } from '@wara/content/schema';
import { DrillFeedback } from '@/components/DrillFeedback';
import { TYPOGRAPHY } from '@/lib/typography';

const REQUIRED_STREAK = 3;

export type ContrastDrillProps = {
  readonly target: KanaItem;
  readonly partner: KanaItem;
  readonly rng: () => number;
  readonly onDone: () => void;
};

type ContrastRound = {
  readonly number: number;
  readonly asked: KanaItem;
  readonly order: readonly [KanaItem, KanaItem];
};

const drawRound = (target: KanaItem, partner: KanaItem, rng: () => number, number: number): ContrastRound => ({
  number,
  asked: rng() < 0.5 ? target : partner,
  order: rng() < 0.5 ? [target, partner] : [partner, target],
});

export function ContrastDrill({ target, partner, rng, onDone }: ContrastDrillProps): ReactElement {
  const [round, setRound] = useState<ContrastRound>(() => drawRound(target, partner, rng, 0));
  const [pick, setPick] = useState<KanaItem | null>(null);
  const [streak, setStreak] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <h2 className={TYPOGRAPHY.sectionTitle}>
        Bedakan <span lang="ja">{target.data.char}</span> dan <span lang="ja">{partner.data.char}</span>
      </h2>
      <p className="text-sm text-muted-foreground">
        Benar berturut-turut: {streak}/{REQUIRED_STREAK}
      </p>
      <p className="text-4xl font-semibold">Pilih: {round.asked.data.romaji}</p>
      <div className="grid grid-cols-2 gap-2">
        {round.order.map((choice) => (
          <button
            key={choice.id}
            type="button"
            disabled={pick !== null}
            onClick={() => {
              setPick(choice);
              setStreak(choice.id === round.asked.id ? streak + 1 : 0);
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
          key={round.number}
          correct={pick.id === round.asked.id}
          answer={<span lang="ja">{round.asked.data.char}</span>}
          onContinue={() => {
            if (streak >= REQUIRED_STREAK) {
              onDone();
              return;
            }
            setRound(drawRound(target, partner, rng, round.number + 1));
            setPick(null);
          }}
        />
      )}
    </div>
  );
}

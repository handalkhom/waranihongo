import type { ReactElement } from 'react';
import type { KanaData, KanaItem } from '@wara/content/schema';
import { KanaToRomajiDrill, type KanaDrillAnswer } from '@/modules/kana';
import { TYPOGRAPHY } from '@/lib/typography';

export interface PlacementTestProps {
  readonly item: KanaItem;
  readonly position: number;
  readonly total: number;
  readonly failedAttempts: number;
  readonly kana: ReadonlyArray<KanaData>;
  readonly onAnswer: (answer: KanaDrillAnswer) => void;
  readonly onSkip: () => void;
}

export function PlacementTest({
  item,
  position,
  total,
  failedAttempts,
  kana,
  onAnswer,
  onSkip,
}: PlacementTestProps): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className={TYPOGRAPHY.pageTitle}>Uji cepat kana</h1>
        <p className="text-sm text-muted-foreground">{`Huruf ${String(position + 1)} dari ${String(total)}`}</p>
      </div>
      {failedAttempts > 0 && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Jawaban gagal disimpan. Coba jawab lagi.
        </p>
      )}
      <KanaToRomajiDrill
        key={`${item.id}:${String(failedAttempts)}`}
        item={item}
        answerMode="typed"
        kana={kana}
        onAnswer={onAnswer}
      />
      <button
        type="button"
        onClick={onSkip}
        className="h-11 rounded-md border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9"
      >
        Belum kenal
      </button>
    </div>
  );
}

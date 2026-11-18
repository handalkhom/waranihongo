import type { ReactElement } from 'react';
import type { KanaData } from '@wara/content/schema';
import {
  DictationDrill,
  KanaToRomajiDrill,
  RomajiToKanaDrill,
  WordReadingDrill,
  type KanaDrillAnswer,
} from '@/modules/kana';
import type { SessionDrill } from './useSessionRunner';

export type SessionDrillViewProps = {
  readonly drill: SessionDrill;
  readonly kana: ReadonlyArray<KanaData>;
  readonly onAnswer: (answer: KanaDrillAnswer) => void;
};

export function SessionDrillView({ drill, kana, onAnswer }: SessionDrillViewProps): ReactElement {
  switch (drill.kind) {
    case 'kana-to-romaji':
      if (drill.answerMode === 'choice') {
        return (
          <KanaToRomajiDrill item={drill.item} answerMode="choice" choices={drill.choices} onAnswer={onAnswer} />
        );
      }
      return <KanaToRomajiDrill item={drill.item} answerMode="typed" kana={kana} onAnswer={onAnswer} />;
    case 'romaji-to-kana':
      return <RomajiToKanaDrill item={drill.item} choices={drill.choices} onAnswer={onAnswer} />;
    case 'dictation':
      return <DictationDrill item={drill.item} choices={drill.choices} onAnswer={onAnswer} />;
    case 'word-reading':
      return <WordReadingDrill item={drill.item} kana={kana} onAnswer={onAnswer} />;
    default:
      return drill satisfies never;
  }
}

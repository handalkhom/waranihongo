import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { romajiMatches, type ConfusionAnswer } from '@wara/core';
import type { KanaData, KanaItem } from '@wara/content/schema';
import { DrillFeedback } from '@/components/DrillFeedback';
import type { KanaDrillAnswer } from './types';

export type KanaToRomajiDrillProps = {
  readonly item: KanaItem;
  readonly onAnswer: (answer: KanaDrillAnswer) => void;
} & (
  | { readonly answerMode: 'choice'; readonly choices: ReadonlyArray<KanaItem> }
  | { readonly answerMode: 'typed'; readonly kana: ReadonlyArray<KanaData> }
);

type Answered = Omit<KanaDrillAnswer, 'itemId'>;

type AnswerHandler = (correct: boolean, given: ConfusionAnswer) => void;

export function KanaToRomajiDrill(props: KanaToRomajiDrillProps): ReactElement {
  const { item, onAnswer } = props;
  const startedAt = useRef(0);
  const [answered, setAnswered] = useState<Answered | null>(null);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const handleAnswer: AnswerHandler = (correct, given) => {
    const elapsedMs = Date.now() - startedAt.current;
    setAnswered((current) => (current === null ? { correct, given, elapsedMs } : current));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">Bagaimana bacaan huruf ini?</p>
        <p lang="ja" className="text-7xl font-medium leading-none">
          {item.data.char}
        </p>
      </div>
      {props.answerMode === 'choice' ? (
        <ChoiceAnswers item={item} choices={props.choices} locked={answered !== null} onAnswer={handleAnswer} />
      ) : (
        <TypedAnswer item={item} kana={props.kana} locked={answered !== null} onAnswer={handleAnswer} />
      )}
      {answered !== null && (
        <DrillFeedback
          correct={answered.correct}
          answer={item.data.romaji}
          onContinue={() => {
            onAnswer({ itemId: item.id, ...answered });
          }}
        />
      )}
    </div>
  );
}

function ChoiceAnswers({
  item,
  choices,
  locked,
  onAnswer,
}: {
  readonly item: KanaItem;
  readonly choices: ReadonlyArray<KanaItem>;
  readonly locked: boolean;
  readonly onAnswer: AnswerHandler;
}): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3">
      {choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          disabled={locked}
          onClick={() => {
            onAnswer(choice.id === item.id, { mode: 'choice', itemId: choice.id });
          }}
          className="h-14 rounded-md border text-base font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {choice.data.romaji}
        </button>
      ))}
    </div>
  );
}

function TypedAnswer({
  item,
  kana,
  locked,
  onAnswer,
}: {
  readonly item: KanaItem;
  readonly kana: ReadonlyArray<KanaData>;
  readonly locked: boolean;
  readonly onAnswer: AnswerHandler;
}): ReactElement {
  const inputId = useId();
  const [text, setText] = useState('');
  const blank = text.trim() === '';

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (locked || blank) return;
        onAnswer(romajiMatches({ reading: item.data.char, given: text, kana }), { mode: 'typed', text });
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
          className="h-11 min-w-0 flex-1 rounded-md border bg-transparent px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 read-only:opacity-70 md:h-9 md:text-sm"
        />
        <button
          type="submit"
          disabled={locked || blank}
          className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 md:h-9"
        >
          Kirim
        </button>
      </div>
    </form>
  );
}

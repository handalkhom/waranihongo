import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';

const AUTO_ADVANCE_MS = 800;

export function DrillFeedback({
  correct,
  answer,
  onContinue,
}: {
  readonly correct: boolean;
  readonly answer: ReactNode;
  readonly onContinue: () => void;
}): ReactElement {
  const latestContinue = useRef(onContinue);
  const [continued, setContinued] = useState(false);

  useEffect(() => {
    latestContinue.current = onContinue;
  }, [onContinue]);

  useEffect(() => {
    if (!correct) return undefined;
    const timer = setTimeout(() => {
      latestContinue.current();
    }, AUTO_ADVANCE_MS);
    return (): void => {
      clearTimeout(timer);
    };
  }, [correct]);

  if (correct) {
    return (
      <div className="flex flex-col gap-2">
        <p role="status" className="font-medium text-emerald-600 dark:text-emerald-400">
          Benar
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="font-medium text-red-600 dark:text-red-400">
        Belum tepat
      </p>
      <p className="text-sm">Jawaban yang benar: {answer}</p>
      <button
        type="button"
        autoFocus
        disabled={continued}
        onClick={() => {
          setContinued(true);
          onContinue();
        }}
        className="h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 md:h-9"
      >
        Lanjut
      </button>
    </div>
  );
}

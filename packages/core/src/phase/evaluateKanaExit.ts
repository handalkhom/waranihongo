import { KANA_EXIT_TIME_LIMIT_MS, KANA_EXIT_WORD_COUNT } from '../session/defaults';

export function evaluateKanaExit(
  answers: ReadonlyArray<{ readonly itemId: string; readonly correct: boolean }>,
  elapsedMs: number,
): { readonly passed: boolean; readonly wrong: ReadonlyArray<string> } {
  const wrong = answers.filter((answer) => !answer.correct).map((answer) => answer.itemId);
  return {
    passed:
      answers.length === KANA_EXIT_WORD_COUNT &&
      wrong.length === 0 &&
      elapsedMs <= KANA_EXIT_TIME_LIMIT_MS,
    wrong,
  };
}

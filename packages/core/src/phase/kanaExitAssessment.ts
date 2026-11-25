import type { KanaExitAssessment, LocalDate } from '../domain';
import { evaluateKanaExit } from './evaluateKanaExit';

export function kanaExitAssessment({
  answers,
  elapsedMs,
  id,
  date,
}: {
  readonly answers: ReadonlyArray<{ readonly itemId: string; readonly correct: boolean }>;
  readonly elapsedMs: number;
  readonly id: string;
  readonly date: LocalDate;
}): KanaExitAssessment {
  const { passed, wrong } = evaluateKanaExit(answers, elapsedMs);
  return {
    id,
    date,
    kind: 'kana-exit',
    passed,
    correct: answers.filter((answer) => answer.correct).length,
    total: answers.length,
    elapsedMs,
    wrong,
  };
}

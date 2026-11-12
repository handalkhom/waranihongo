import type { Phase } from '@wara/content/schema';
import type { Assessment } from '../domain';
import { JLPT_SIM_PASS_SCORE } from '../session/defaults';

export function derivePhase(input: { readonly assessments: ReadonlyArray<Assessment> }): Phase {
  const { assessments } = input;
  if (!assessments.some((a) => a.kind === 'kana-exit' && a.passed)) return 0;
  if (!assessments.some((a) => a.kind === 'jlpt-sim' && a.level === 'n5' && a.score >= JLPT_SIM_PASS_SCORE.n5)) {
    return 1;
  }
  if (!assessments.some((a) => a.kind === 'jlpt-sim' && a.level === 'n4' && a.score >= JLPT_SIM_PASS_SCORE.n4)) {
    return 2;
  }
  return 3;
}

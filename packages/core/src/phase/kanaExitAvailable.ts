import type { Assessment, ReviewState } from '../domain';

export function kanaExitAvailable({
  kanaIds,
  states,
  assessments,
}: {
  readonly kanaIds: ReadonlyArray<string>;
  readonly states: ReadonlyArray<ReviewState>;
  readonly assessments: ReadonlyArray<Assessment>;
}): boolean {
  if (kanaIds.length === 0) return false;
  const reviewedIds = new Set(states.map((state) => state.itemId));
  return (
    kanaIds.every((id) => reviewedIds.has(id)) &&
    !assessments.some((assessment) => assessment.kind === 'kana-exit' && assessment.passed)
  );
}

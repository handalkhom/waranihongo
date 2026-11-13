import type { ConfusionGroup, ContentItem, KanaData } from '@wara/content/schema';
import { romajiMatches } from '../answer/romajiMatches';
import type { ReviewState } from '../domain';

export type ConfusionAnswer =
  | { readonly mode: 'typed'; readonly text: string }
  | { readonly mode: 'choice'; readonly itemId: string };

export interface ConfusionResult {
  readonly confusedWith: string | null;
  readonly moved: ReadonlyArray<ReviewState>;
  readonly priorityNew: ReadonlyArray<string>;
}

interface Candidate {
  readonly id: string;
  readonly reading: string;
  readonly superseded: boolean;
}

const NO_CONFUSION: ConfusionResult = { confusedWith: null, moved: [], priorityNew: [] };

function vocabCandidate(item: Extract<ContentItem, { type: 'vocab' }>): Candidate {
  switch (item.source) {
    case 'content':
      return { id: item.id, reading: item.data.reading, superseded: item.supersededBy !== undefined };
    case 'custom':
      return { id: item.id, reading: item.data.reading, superseded: false };
    default:
      return item satisfies never;
  }
}

function candidateOf(item: ContentItem): Candidate {
  switch (item.type) {
    case 'kana':
      return { id: item.id, reading: item.data.char, superseded: item.supersededBy !== undefined };
    case 'vocab':
      return vocabCandidate(item);
    default:
      return item satisfies never;
  }
}

function typedPartner(
  text: string,
  self: Candidate | undefined,
  partners: ReadonlyArray<Candidate>,
  kana: ReadonlyArray<KanaData>,
): Candidate | undefined {
  const matches = (candidate: Candidate): boolean => romajiMatches({ reading: candidate.reading, given: text, kana });
  if (self !== undefined && matches(self)) return undefined;
  return partners.find(matches);
}

function confusedPartner(
  given: ConfusionAnswer,
  self: Candidate | undefined,
  partners: ReadonlyArray<Candidate>,
  items: ReadonlyArray<ContentItem>,
): Candidate | undefined {
  switch (given.mode) {
    case 'choice':
      return partners.find((partner) => partner.id === given.itemId);
    case 'typed':
      return typedPartner(
        given.text,
        self,
        partners,
        items.flatMap((item) => (item.type === 'kana' ? [item.data] : [])),
      );
    default:
      return given satisfies never;
  }
}

export function applyConfusion({
  itemId,
  given,
  groups,
  items,
  states,
  now,
}: {
  readonly itemId: string;
  readonly given: ConfusionAnswer;
  readonly groups: ReadonlyArray<ConfusionGroup>;
  readonly items: ReadonlyArray<ContentItem>;
  readonly states: ReadonlyArray<ReviewState>;
  readonly now: Date;
}): ConfusionResult {
  const candidates: ReadonlyMap<string, Candidate> = new Map(
    items.map((item): readonly [string, Candidate] => [item.id, candidateOf(item)]),
  );
  const partners = groups
    .filter((group) => group.items.includes(itemId))
    .flatMap((group) => group.items.filter((id) => id !== itemId))
    .map((id) => candidates.get(id))
    .filter((candidate): candidate is Candidate => candidate !== undefined && !candidate.superseded);
  if (partners.length === 0) return NO_CONFUSION;
  const partner = confusedPartner(given, candidates.get(itemId), partners, items);
  if (partner === undefined) return NO_CONFUSION;
  const state = states.find((candidate) => candidate.itemId === partner.id);
  if (state === undefined) return { confusedWith: partner.id, moved: [], priorityNew: [partner.id] };
  return {
    confusedWith: partner.id,
    moved: [{ ...state, due: state.due.getTime() <= now.getTime() ? state.due : now }],
    priorityNew: [],
  };
}

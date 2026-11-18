import type { ContentItem, KanaItem, VocabItem } from '@wara/content/schema';
import { describe, expect, it } from 'vitest';
import type { ReviewState } from '../../src/domain';
import { weakSeedChoices } from '../../src/session/weakSeedChoices';

const NOW = new Date('2026-11-16T09:00:00Z');

const kana = (char: string, romaji: string, group: KanaItem['data']['group'], script: 'hiragana' | 'katakana' = 'hiragana'): KanaItem => ({
  type: 'kana',
  id: `kana:${script === 'hiragana' ? 'hira' : 'kata'}:${char}`,
  level: 'kana',
  phase: 0,
  tags: [],
  data: { char, romaji, romajiAccepted: romaji === '' ? [] : [romaji], script, group },
});

const NE = kana('ね', 'ne', 'basic');
const RE = kana('れ', 're', 'basic');
const SO = kana('ソ', 'so', 'basic', 'katakana');
const PI = kana('ぴ', 'pi', 'handakuten');
const SHA = kana('しゃ', 'sha', 'combination');
const SMALL_TSU = kana('っ', '', 'small');
const SMALL_TSU_KATA = kana('ッ', '', 'small', 'katakana');
const CHOONPU = kana('ー', '', 'mark', 'katakana');

const OLD_WI: KanaItem = { ...kana('ゐ', 'wi', 'basic'), supersededBy: 'kana:hira:い' };

const NEKO: VocabItem = {
  type: 'vocab',
  source: 'content',
  id: 'vocab:n5:ねこ',
  level: 'n5',
  phase: 0,
  tags: [],
  data: { word: 'ねこ', reading: 'ねこ', meaningId: 'vocab:n5:ねこ', pos: 'noun', register: 'plain', examples: [] },
};

const ITEMS: ReadonlyArray<ContentItem> = [NE, RE, SO, PI, SHA, SMALL_TSU, SMALL_TSU_KATA, CHOONPU, OLD_WI, NEKO];

const stateOf = (itemId: string): ReviewState => ({
  itemId,
  stability: 3.2,
  difficulty: 5,
  due: NOW,
  lastReview: new Date('2026-11-13T09:00:00Z'),
  reps: 1,
  lapses: 0,
  learningSteps: 0,
  state: 'learning',
});

describe('weakSeedChoices — order and identity', () => {
  it('should keep seedIds order when items are listed in a different order', () => {
    const result = weakSeedChoices({ seedIds: [SO.id, PI.id, NE.id], items: ITEMS, states: [] });
    expect(result.map((item) => item.id)).toEqual([SO.id, PI.id, NE.id]);
  });

  it('should return the very objects from items', () => {
    const result = weakSeedChoices({ seedIds: [RE.id, SHA.id], items: ITEMS, states: [] });
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(RE);
    expect(result[1]).toBe(SHA);
  });
});

describe('weakSeedChoices — measured seeds', () => {
  it('should drop a seed that has a state while keeping its unstated neighbour', () => {
    const result = weakSeedChoices({ seedIds: [NE.id, RE.id], items: ITEMS, states: [stateOf(NE.id)] });
    expect(result).toEqual([RE]);
  });

  it('should return an empty list when every seed has a state, though the same seeds unstated are all returned', () => {
    const seedIds = [NE.id, RE.id, SO.id];
    expect(weakSeedChoices({ seedIds, items: ITEMS, states: [] })).toEqual([NE, RE, SO]);
    expect(weakSeedChoices({ seedIds, items: ITEMS, states: seedIds.map(stateOf) })).toEqual([]);
  });

  it('should ignore a state that belongs to an item that is not a seed', () => {
    const result = weakSeedChoices({
      seedIds: [NE.id, PI.id],
      items: ITEMS,
      states: [stateOf(RE.id), stateOf(SO.id), stateOf(NEKO.id)],
    });
    expect(result).toEqual([NE, PI]);
  });
});

describe('weakSeedChoices — skipped seeds', () => {
  it('should skip a seed id that is absent from items', () => {
    const result = weakSeedChoices({ seedIds: ['kana:hira:ゑ', NE.id, 'kana:kata:ヲ'], items: ITEMS, states: [] });
    expect(result).toEqual([NE]);
  });

  it('should skip a vocab seed when it resolves to a non-kana item', () => {
    const result = weakSeedChoices({ seedIds: [NEKO.id, RE.id], items: ITEMS, states: [] });
    expect(result).toEqual([RE]);
  });

  it('should skip a non-drillable kana whose romaji is empty (small tsu and the long-vowel mark)', () => {
    const result = weakSeedChoices({
      seedIds: [SMALL_TSU.id, NE.id, SMALL_TSU_KATA.id, CHOONPU.id, SO.id],
      items: ITEMS,
      states: [],
    });
    expect(result).toEqual([NE, SO]);
  });

  it('should skip a superseded kana while keeping the seed after it', () => {
    const result = weakSeedChoices({ seedIds: [OLD_WI.id, PI.id], items: ITEMS, states: [] });
    expect(result).toEqual([PI]);
  });

  it('should return a repeated seed id only once, at its first position', () => {
    const result = weakSeedChoices({ seedIds: [RE.id, NE.id, RE.id, NE.id], items: ITEMS, states: [] });
    expect(result).toEqual([RE, NE]);
  });

  it('should return an empty list when seedIds is empty, though the same items with a seed return it', () => {
    expect(weakSeedChoices({ seedIds: [], items: ITEMS, states: [] })).toEqual([]);
    expect(weakSeedChoices({ seedIds: [NE.id], items: ITEMS, states: [] })).toEqual([NE]);
  });
});

describe('weakSeedChoices — the onboarding checklist', () => {
  it('should offer ぴ and しゃ when the seeds are ね, ぴ, しゃ, っ and only ね was answered in the quick test', () => {
    const result = weakSeedChoices({
      seedIds: ['kana:hira:ね', 'kana:hira:ぴ', 'kana:hira:しゃ', 'kana:hira:っ'],
      items: ITEMS,
      states: [stateOf('kana:hira:ね')],
    });
    expect(result.map((item) => item.data.char)).toEqual(['ぴ', 'しゃ']);
    expect(result).toEqual([PI, SHA]);
  });
});

describe('weakSeedChoices — purity', () => {
  it('should leave seedIds, items, and states unchanged and return the same result twice', () => {
    const seedIds = [SHA.id, NE.id, SMALL_TSU.id, RE.id];
    const items = [...ITEMS];
    const states = [stateOf(NE.id)];
    const snapshot = JSON.stringify({ seedIds, items, states });

    const first = weakSeedChoices({ seedIds, items, states });
    const second = weakSeedChoices({ seedIds, items, states });

    expect(JSON.stringify({ seedIds, items, states })).toBe(snapshot);
    expect(items).toEqual(ITEMS);
    expect(first).toEqual([SHA, RE]);
    expect(second).toEqual(first);
  });
});

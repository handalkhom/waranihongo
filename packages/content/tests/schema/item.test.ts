import { describe, expect, it } from 'vitest';
import {
  contentItemSchema,
  customVocabItemSchema,
  dataItemSchema,
  kanaItemSchema,
  vocabItemSchema,
  type CustomVocabData,
  type CustomVocabItem,
  type KanaData,
  type KanaItem,
  type VocabData,
  type VocabItem,
} from '../../src/schema/item';

const kana = (item: Partial<Omit<KanaItem, 'data'>> = {}, data: Partial<KanaData> = {}): KanaItem => ({
  type: 'kana',
  id: 'kana:hira:ね',
  level: 'kana',
  phase: 0,
  tags: [],
  ...item,
  data: { char: 'ね', romaji: 'ne', romajiAccepted: ['ne'], script: 'hiragana', group: 'basic', ...data },
});

const vocab = (item: Partial<Omit<VocabItem, 'data'>> = {}, data: Partial<VocabData> = {}): VocabItem => ({
  type: 'vocab',
  source: 'content',
  id: 'vocab:other:やくそく',
  level: 'other',
  phase: 0,
  tags: ['reading-practice'],
  ...item,
  data: {
    word: 'やくそく',
    reading: 'やくそく',
    meaningId: 'vocab:other:やくそく',
    pos: 'noun',
    register: 'plain',
    examples: [{ ja: 'やくそくを まもる。', id: 'menepati janji' }],
    ...data,
  },
});

const custom = (
  item: Partial<Omit<CustomVocabItem, 'data'>> = {},
  data: Partial<CustomVocabData> = {},
): CustomVocabItem => ({
  type: 'vocab',
  source: 'custom',
  id: 'vocab:custom:3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c',
  level: 'custom',
  phase: 1,
  tags: [],
  ...item,
  data: { word: '先輩', reading: 'せんぱい', meaning: 'kakak kelas', ...data },
});

const BAD_TAGS: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
  ['an empty tag', ['']],
  ['an uppercase tag', ['Weak']],
  ['a tag containing a space', ['reading practice']],
  ['the same tag twice', ['weak', 'weak']],
];

const NFD_GA = 'が'.normalize('NFD');

describe('kanaItemSchema: valid items', () => {
  it.each<readonly [string, KanaItem]>([
    ['the hiragana baseline ね', kana()],
    [
      'katakana ン with n and nn accepted',
      kana(
        { id: 'kana:kata:ン' },
        { char: 'ン', romaji: 'n', romajiAccepted: ['n', 'nn'], script: 'katakana' },
      ),
    ],
    [
      'the combination しゃ',
      kana({ id: 'kana:hira:しゃ' }, { char: 'しゃ', romaji: 'sha', romajiAccepted: ['sha'], group: 'combination' }),
    ],
    ['を with o and wo accepted', kana({ id: 'kana:hira:を' }, { char: 'を', romaji: 'o', romajiAccepted: ['o', 'wo'] })],
    [
      'small っ with no romaji and no accepted answer',
      kana({ id: 'kana:hira:っ' }, { char: 'っ', romaji: '', romajiAccepted: [], group: 'small' }),
    ],
    [
      'the prolonged sound mark ー with no romaji and no accepted answer',
      kana(
        { id: 'kana:kata:ー' },
        { char: 'ー', romaji: '', romajiAccepted: [], script: 'katakana', group: 'mark' },
      ),
    ],
    ['a mnemonic in Indonesian', kana({}, { mnemonic: 'Seperti angka 2 dengan ekor' })],
    ['two well-formed tags', kana({ tags: ['weak', 'reading-practice'] })],
  ])('should accept %s', (_label, item) => {
    expect(kanaItemSchema.safeParse(item).success).toBe(true);
  });
});

describe('kanaItemSchema: script and char agree with the id', () => {
  it('should reject script katakana on a kana:hira id', () => {
    expect(kanaItemSchema.safeParse(kana({}, { script: 'katakana' })).success).toBe(false);
  });

  it('should reject script hiragana on a kana:kata id', () => {
    const item = kana(
      { id: 'kana:kata:ン' },
      { char: 'ン', romaji: 'n', romajiAccepted: ['n', 'nn'], script: 'hiragana' },
    );
    expect(kanaItemSchema.safeParse(item).success).toBe(false);
  });

  it('should reject a kana item whose char differs from its id slug', () => {
    expect(kanaItemSchema.safeParse(kana({}, { char: 'れ', romaji: 're', romajiAccepted: ['re'] })).success).toBe(
      false,
    );
  });
});

describe('kanaItemSchema: phase', () => {
  it('should reject a kana item at phase 1, since every kana belongs to phase 0', () => {
    expect(kanaItemSchema.safeParse(kana({ phase: 1 })).success).toBe(false);
  });
});

describe('kanaItemSchema: romaji and romajiAccepted', () => {
  it.each<readonly [string, Partial<KanaData>]>([
    ['romaji with an uppercase letter', { romaji: 'Ne', romajiAccepted: ['Ne'] }],
    ['romaji containing a digit', { romaji: 'ne1', romajiAccepted: ['ne1'] }],
    ['romajiAccepted that does not contain the romaji', { romaji: 'ne', romajiAccepted: ['nee'] }],
    ['romajiAccepted holding the same answer twice', { romaji: 'ne', romajiAccepted: ['ne', 'ne'] }],
    ['a romajiAccepted entry with uppercase letters', { romaji: 'ne', romajiAccepted: ['ne', 'NE'] }],
  ])('should reject %s', (_label, data) => {
    expect(kanaItemSchema.safeParse(kana({}, data)).success).toBe(false);
  });

  it('should reject an empty romaji with a non-empty romajiAccepted', () => {
    const item = kana({ id: 'kana:hira:っ' }, { char: 'っ', romaji: '', romajiAccepted: ['tsu'], group: 'small' });
    expect(kanaItemSchema.safeParse(item).success).toBe(false);
  });
});

describe('kanaItemSchema: mnemonic', () => {
  it.each([
    ['an empty mnemonic', ''],
    ['a mnemonic with surrounding spaces', ' Seperti angka 2 dengan ekor '],
    ['a mnemonic in decomposed (NFD) form', `Mirip ${NFD_GA} tanpa titik`],
  ])('should reject %s', (_label, mnemonic) => {
    expect(kanaItemSchema.safeParse(kana({}, { mnemonic })).success).toBe(false);
  });
});

describe('kanaItemSchema: tags and supersededBy', () => {
  it.each(BAD_TAGS)('should reject a kana item with %s', (_label, tags) => {
    expect(kanaItemSchema.safeParse(kana({ tags })).success).toBe(false);
  });

  it('should reject a kana item superseded by its own id', () => {
    expect(kanaItemSchema.safeParse(kana({ supersededBy: 'kana:hira:ね' })).success).toBe(false);
  });
});

describe('vocabItemSchema: valid items', () => {
  it.each<readonly [string, VocabItem]>([
    ['the baseline やくそく', vocab()],
    [
      'vocab:n5:一日~ついたち at phase 1 with its ~ reading',
      vocab(
        { id: 'vocab:n5:一日~ついたち', level: 'n5', phase: 1 },
        { word: '一日', reading: 'ついたち', meaningId: 'vocab:n5:一日~ついたち' },
      ),
    ],
    [
      'a katakana word with a katakana reading',
      vocab({ id: 'vocab:other:コーヒー' }, { word: 'コーヒー', reading: 'コーヒー', meaningId: 'vocab:other:コーヒー' }),
    ],
    ['an item superseded by another id', vocab({ supersededBy: 'vocab:n5:約束' })],
    [
      'a kanji word at phase 1',
      vocab(
        { id: 'vocab:n5:友達', level: 'n5', phase: 1 },
        { word: '友達', reading: 'ともだち', meaningId: 'vocab:n5:友達' },
      ),
    ],
    ['a kanji example at phase 1', vocab({ phase: 1 }, { examples: [{ ja: '約束を 守る。', id: 'menepati janji' }] })],
  ])('should accept %s', (_label, item) => {
    expect(vocabItemSchema.safeParse(item).success).toBe(true);
  });
});

describe('vocabItemSchema: id agrees with level, word and reading', () => {
  it('should reject level n5 on a vocab:other id', () => {
    expect(vocabItemSchema.safeParse(vocab({ level: 'n5' })).success).toBe(false);
  });

  it.each(['やくそく2', 'ともだち'])('should reject the word %j on id vocab:other:やくそく', (word) => {
    expect(vocabItemSchema.safeParse(vocab({}, { word })).success).toBe(false);
  });

  it('should reject a reading that differs from the ~ suffix of the id', () => {
    const item = vocab(
      { id: 'vocab:n5:一日~ついたち', level: 'n5', phase: 1 },
      { word: '一日', reading: 'いちにち', meaningId: 'vocab:n5:一日~ついたち' },
    );
    expect(vocabItemSchema.safeParse(item).success).toBe(false);
  });
});

describe('vocabItemSchema: reading and meaningId', () => {
  it.each([
    ['a reading containing kanji', '一日'],
    ['a reading in romaji', 'yakusoku'],
    ['an empty reading', ''],
  ])('should reject %s', (_label, reading) => {
    expect(vocabItemSchema.safeParse(vocab({}, { reading })).success).toBe(false);
  });

  it('should reject an empty meaningId', () => {
    expect(vocabItemSchema.safeParse(vocab({}, { meaningId: '' })).success).toBe(false);
  });
});

describe('vocabItemSchema: a phase-0 item contains no kanji', () => {
  it('should reject a phase-0 item whose word contains kanji', () => {
    const item = vocab(
      { id: 'vocab:n5:友達', level: 'n5', phase: 0 },
      { word: '友達', reading: 'ともだち', meaningId: 'vocab:n5:友達' },
    );
    expect(vocabItemSchema.safeParse(item).success).toBe(false);
  });

  it('should reject a phase-0 item whose example contains kanji', () => {
    const item = vocab({ phase: 0 }, { examples: [{ ja: '約束を 守る。', id: 'menepati janji' }] });
    expect(vocabItemSchema.safeParse(item).success).toBe(false);
  });
});

describe('vocabItemSchema: examples', () => {
  it.each([
    ['an empty Japanese sentence', { ja: '', id: 'menepati janji' }],
    ['a Japanese sentence in romaji', { ja: 'yakusoku wo mamoru', id: 'menepati janji' }],
    ['a Japanese sentence with surrounding spaces', { ja: ' やくそくを まもる。 ', id: 'menepati janji' }],
    ['an empty Indonesian translation', { ja: 'やくそくを まもる。', id: '' }],
    ['an Indonesian translation with surrounding spaces', { ja: 'やくそくを まもる。', id: ' menepati janji ' }],
  ])('should reject an example with %s', (_label, example) => {
    expect(vocabItemSchema.safeParse(vocab({}, { examples: [example] })).success).toBe(false);
  });
});

describe('vocabItemSchema: tags, supersededBy, unknown keys', () => {
  it.each(BAD_TAGS)('should reject a vocab item with %s', (_label, tags) => {
    expect(vocabItemSchema.safeParse(vocab({ tags })).success).toBe(false);
  });

  it('should reject a vocab item superseded by its own id', () => {
    expect(vocabItemSchema.safeParse(vocab({ supersededBy: 'vocab:other:やくそく' })).success).toBe(false);
  });

  it('should reject romaji as an unknown key in vocab data', () => {
    const base = vocab();
    const item: unknown = { ...base, data: { ...base.data, romaji: 'yakusoku' } };
    expect(vocabItemSchema.safeParse(item).success).toBe(false);
  });
});

describe('customVocabItemSchema', () => {
  it('should accept the learner-made baseline 先輩', () => {
    expect(customVocabItemSchema.safeParse(custom()).success).toBe(true);
  });

  it.each<readonly [string, Partial<CustomVocabData>]>([
    ['a reading containing kanji', { reading: '先輩' }],
    ['a reading in romaji', { reading: 'senpai' }],
    ['an empty word', { word: '' }],
    ['a word with surrounding spaces', { word: ' 先輩 ' }],
    ['an empty meaning', { meaning: '' }],
    ['a meaning with surrounding spaces', { meaning: ' kakak kelas ' }],
    ['a word in decomposed (NFD) form', { word: 'がっこう'.normalize('NFD'), reading: 'がっこう' }],
  ])('should reject a custom vocab item with %s', (_label, data) => {
    expect(customVocabItemSchema.safeParse(custom({}, data)).success).toBe(false);
  });
});

describe('dataItemSchema and contentItemSchema', () => {
  it('should accept kana and content vocab in dataItemSchema', () => {
    expect(dataItemSchema.safeParse(kana()).success).toBe(true);
    expect(dataItemSchema.safeParse(vocab()).success).toBe(true);
  });

  it('should reject learner-made vocab in dataItemSchema, since it never appears in a data file', () => {
    expect(dataItemSchema.safeParse(custom()).success).toBe(false);
  });

  it('should accept kana, content vocab and learner-made vocab in contentItemSchema', () => {
    expect(contentItemSchema.safeParse(kana()).success).toBe(true);
    expect(contentItemSchema.safeParse(vocab()).success).toBe(true);
    expect(contentItemSchema.safeParse(custom()).success).toBe(true);
  });

  it.each<readonly [string, unknown]>([
    ['an unknown vocab source', { ...vocab(), source: 'x' }],
    ['an unknown type', { ...kana(), type: 'grammar' }],
  ])('should reject %s in both unions', (_label, item) => {
    expect(dataItemSchema.safeParse(item).success).toBe(false);
    expect(contentItemSchema.safeParse(item).success).toBe(false);
  });
});

describe('parsed items are immutable', () => {
  it('should freeze tags and romajiAccepted after a successful parse', () => {
    const result = kanaItemSchema.safeParse(kana({ tags: ['weak'] }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(Object.isFrozen(result.data.tags)).toBe(true);
    expect(Object.isFrozen(result.data.data.romajiAccepted)).toBe(true);
  });
});

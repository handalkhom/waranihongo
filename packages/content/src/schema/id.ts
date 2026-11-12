import { z } from 'zod';

interface SlugRule {
  readonly pattern: RegExp;
  readonly message: string;
}

const LEVELS = ['n5', 'n4', 'n3', 'n2'] as const;

const HIRAGANA_RULE: SlugRule = {
  pattern: /^[ぁ-ゖ]+$/u,
  message: 'slug kana:hira hanya boleh hiragana',
};

const KATAKANA_RULE: SlugRule = {
  pattern: /^[ァ-ヺー]+$/u,
  message: 'slug kana:kata hanya boleh katakana',
};

const KANJI_RULE: SlugRule = {
  pattern: /^\p{Script=Han}$/u,
  message: 'slug kanji harus tepat satu karakter kanji',
};

const VOCAB_RULE: SlugRule = {
  pattern: /^[^~\p{Script=Latin}]+(?:~[ぁ-ゖァ-ヺー]+)?$/u,
  message: 'slug vocab tidak boleh kosong atau berisi huruf Latin, dan bacaan setelah ~ hanya boleh kana',
};

const GRAMMAR_RULE: SlugRule = {
  pattern: /^\P{Script=Latin}+$/u,
  message: 'slug grammar tidak boleh kosong atau berisi huruf Latin',
};

const rulesFor = (type: string, groups: ReadonlyArray<string>, rule: SlugRule): ReadonlyArray<readonly [string, SlugRule]> =>
  groups.map((group): readonly [string, SlugRule] => [`${type}:${group}`, rule]);

const SLUG_RULES: ReadonlyMap<string, SlugRule> = new Map([
  ['kana:hira', HIRAGANA_RULE],
  ['kana:kata', KATAKANA_RULE],
  ...rulesFor('vocab', [...LEVELS, 'other'], VOCAB_RULE),
  ...rulesFor('kanji', LEVELS, KANJI_RULE),
  ...rulesFor('grammar', LEVELS, GRAMMAR_RULE),
]);

const contentIdIssue = (id: string): string | null => {
  if (id !== id.normalize('NFC')) return 'id harus dalam bentuk NFC';
  const groupEnd = id.indexOf(':', id.indexOf(':') + 1);
  if (groupEnd < 0) return 'id harus berbentuk <type>:<group>:<slug>';
  const rule = SLUG_RULES.get(id.slice(0, groupEnd));
  if (rule === undefined) return `jenis atau grup "${id.slice(0, groupEnd)}" tidak dikenal`;
  return rule.pattern.test(id.slice(groupEnd + 1)) ? null : rule.message;
};

export const contentIdSchema: z.ZodType<string> = z.string().superRefine((id, ctx) => {
  const message = contentIdIssue(id);
  if (message !== null) ctx.addIssue({ code: 'custom', message });
});

export const customVocabIdSchema: z.ZodType<string> = z
  .string()
  .regex(
    /^vocab:custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    'id kosakata buatan harus berbentuk vocab:custom:<uuid huruf kecil>',
  );

export type ContentId = z.infer<typeof contentIdSchema>;

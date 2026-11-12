import { z } from 'zod';
import { contentIdSchema, customVocabIdSchema } from './id';

const HAN = /\p{Script=Han}/u;
const LATIN = /\p{Script=Latin}/u;

const SCRIPT_PREFIX = { hiragana: 'kana:hira:', katakana: 'kana:kata:' } as const;

const isUnique = (values: ReadonlyArray<string>): boolean => new Set(values).size === values.length;

const groupEndOf = (id: string): number => id.indexOf(':', id.indexOf(':') + 1);

const textSchema = z
  .string()
  .min(1, 'teks tidak boleh kosong')
  .refine((text) => text === text.trim() && text === text.normalize('NFC'), {
    message: 'teks tidak boleh diawali atau diakhiri spasi dan harus dalam bentuk NFC',
  });

const readingSchema = z.string().regex(/^[ぁ-ゖァ-ヺー]+$/u, 'bacaan tidak boleh kosong dan hanya boleh berisi kana');

const tagsSchema = z
  .array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/u, 'tag harus huruf kecil, angka, dan tanda hubung'))
  .refine(isUnique, { message: 'tag tidak boleh ganda' })
  .readonly();

export const phaseSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

export const kanaDataSchema = z.strictObject({
  char: z.string(),
  romaji: z.string().regex(/^[a-z]*$/u, 'romaji hanya boleh huruf kecil a-z'),
  romajiAccepted: z
    .array(z.string().regex(/^[a-z']+$/u, 'jawaban romaji hanya boleh huruf kecil a-z atau apostrof'))
    .refine(isUnique, { message: 'jawaban romaji tidak boleh ganda' })
    .readonly(),
  script: z.enum(['hiragana', 'katakana']),
  group: z.enum(['basic', 'dakuten', 'handakuten', 'combination', 'small', 'extended', 'mark']),
  mnemonic: textSchema.optional(),
});

export const kanaItemSchema = z
  .strictObject({
    type: z.literal('kana'),
    id: contentIdSchema,
    level: z.literal('kana'),
    phase: phaseSchema,
    tags: tagsSchema,
    supersededBy: contentIdSchema.optional(),
    data: kanaDataSchema,
  })
  .superRefine((item, ctx) => {
    if (!item.id.startsWith(SCRIPT_PREFIX[item.data.script])) {
      ctx.addIssue({ code: 'custom', message: `script ${item.data.script} tidak cocok dengan id`, path: ['data', 'script'] });
    }
    if (item.data.char !== item.id.slice(groupEndOf(item.id) + 1)) {
      ctx.addIssue({ code: 'custom', message: 'char harus sama dengan slug id', path: ['data', 'char'] });
    }
    if (item.phase !== 0) {
      ctx.addIssue({ code: 'custom', message: 'semua kana berada di fase 0', path: ['phase'] });
    }
    if (item.data.romaji !== '' && !item.data.romajiAccepted.includes(item.data.romaji)) {
      ctx.addIssue({ code: 'custom', message: 'romajiAccepted harus memuat romaji', path: ['data', 'romajiAccepted'] });
    }
    if (item.data.romaji === '' && item.data.romajiAccepted.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'romajiAccepted harus kosong bila romaji kosong',
        path: ['data', 'romajiAccepted'],
      });
    }
    if (item.supersededBy === item.id) {
      ctx.addIssue({ code: 'custom', message: 'item tidak boleh digantikan oleh dirinya sendiri', path: ['supersededBy'] });
    }
  });

export const vocabExampleSchema = z.strictObject({
  ja: textSchema.refine((ja) => !LATIN.test(ja), { message: 'contoh berbahasa Jepang tidak boleh berisi huruf Latin' }),
  id: textSchema,
});

export const vocabDataSchema = z.strictObject({
  word: z.string(),
  reading: readingSchema,
  meaningId: z.string().min(1, 'meaningId tidak boleh kosong'),
  pos: z.enum([
    'noun',
    'verb',
    'i-adjective',
    'na-adjective',
    'adverb',
    'pronoun',
    'particle',
    'conjunction',
    'interjection',
    'expression',
    'counter',
    'prefix',
    'suffix',
  ]),
  register: z.enum(['polite', 'plain', 'rough', 'anime']),
  examples: z.array(vocabExampleSchema).readonly(),
});

export const vocabItemSchema = z
  .strictObject({
    type: z.literal('vocab'),
    source: z.literal('content'),
    id: contentIdSchema,
    level: z.enum(['n5', 'n4', 'n3', 'n2', 'other']),
    phase: phaseSchema,
    tags: tagsSchema,
    supersededBy: contentIdSchema.optional(),
    data: vocabDataSchema,
  })
  .superRefine((item, ctx) => {
    const groupEnd = groupEndOf(item.id);
    const [word, reading] = item.id.slice(groupEnd + 1).split('~');
    if (item.id.slice(item.id.indexOf(':') + 1, groupEnd) !== item.level) {
      ctx.addIssue({ code: 'custom', message: 'level harus sama dengan grup id', path: ['level'] });
    }
    if (item.data.word !== word) {
      ctx.addIssue({ code: 'custom', message: 'word harus sama dengan slug id', path: ['data', 'word'] });
    }
    if (reading !== undefined && item.data.reading !== reading) {
      ctx.addIssue({ code: 'custom', message: 'reading harus sama dengan bacaan setelah ~ di id', path: ['data', 'reading'] });
    }
    if (item.supersededBy === item.id) {
      ctx.addIssue({ code: 'custom', message: 'item tidak boleh digantikan oleh dirinya sendiri', path: ['supersededBy'] });
    }
    if (item.phase !== 0) return;
    if (HAN.test(item.data.word)) {
      ctx.addIssue({ code: 'custom', message: 'kosakata fase 0 tidak boleh berisi kanji', path: ['data', 'word'] });
    }
    item.data.examples.forEach((example, index) => {
      if (!HAN.test(example.ja)) return;
      ctx.addIssue({
        code: 'custom',
        message: 'contoh fase 0 tidak boleh berisi kanji',
        path: ['data', 'examples', index, 'ja'],
      });
    });
  });

export const customVocabDataSchema = z.strictObject({
  word: textSchema,
  reading: readingSchema,
  meaning: textSchema,
});

export const customVocabItemSchema = z.strictObject({
  type: z.literal('vocab'),
  source: z.literal('custom'),
  id: customVocabIdSchema,
  level: z.literal('custom'),
  phase: phaseSchema,
  tags: tagsSchema,
  data: customVocabDataSchema,
});

export const dataItemSchema = z.discriminatedUnion('type', [kanaItemSchema, vocabItemSchema]);

export const contentItemSchema = z.discriminatedUnion('type', [
  kanaItemSchema,
  z.discriminatedUnion('source', [vocabItemSchema, customVocabItemSchema]),
]);

export type Phase = z.infer<typeof phaseSchema>;
export type KanaData = z.infer<typeof kanaDataSchema>;
export type KanaItem = z.infer<typeof kanaItemSchema>;
export type VocabExample = z.infer<typeof vocabExampleSchema>;
export type VocabData = z.infer<typeof vocabDataSchema>;
export type VocabItem = z.infer<typeof vocabItemSchema>;
export type CustomVocabData = z.infer<typeof customVocabDataSchema>;
export type CustomVocabItem = z.infer<typeof customVocabItemSchema>;
export type DataItem = z.infer<typeof dataItemSchema>;
export type ContentItem = z.infer<typeof contentItemSchema>;

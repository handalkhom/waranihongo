import confusionGroups from '../data/confusion-groups.json' with { type: 'json' };
import i18n from '../data/i18n/id.json' with { type: 'json' };
import hiragana from '../data/kana/hiragana.json' with { type: 'json' };
import katakana from '../data/kana/katakana.json' with { type: 'json' };
import seed from '../data/seed/alan-weak.json' with { type: 'json' };
import readingPractice from '../data/vocab/reading-practice.json' with { type: 'json' };
import { parseBundle } from './bundle';
import type { ContentBundle } from './validate/validateBundle';

export type { ContentBundle } from './validate/validateBundle';

export const contentBundle: ContentBundle = parseBundle({
  itemFiles: [
    { path: 'kana/hiragana.json', data: hiragana },
    { path: 'kana/katakana.json', data: katakana },
    { path: 'vocab/reading-practice.json', data: readingPractice },
  ],
  confusionGroups,
  seed,
  i18n,
});

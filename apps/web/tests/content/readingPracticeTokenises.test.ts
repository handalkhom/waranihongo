import { describe, expect, it } from 'vitest';
import { contentBundle } from '@wara/content';
import { ContentValidationError, romajiMatches } from '@wara/core';

const kana = contentBundle.items.flatMap((item) => (item.type === 'kana' ? [item.data] : []));

const readingPracticeWords = contentBundle.items.flatMap((item) =>
  item.type === 'vocab' && item.tags.includes('reading-practice') ? [item.data] : [],
);

const untokenisable = (word: { readonly word: string; readonly reading: string }): ReadonlyArray<string> => {
  try {
    romajiMatches({ reading: word.reading, given: '', kana });
    return [];
  } catch (error) {
    if (error instanceof ContentValidationError) return [`${word.word} (${word.reading})`];
    throw error;
  }
};

describe('reading-practice words in the real content bundle', () => {
  it('should hold at least 60 reading-practice words in the bundle', () => {
    expect(readingPracticeWords.length).toBeGreaterThanOrEqual(60);
  });

  it("should tokenise every reading-practice word against the bundle's kana", () => {
    expect(readingPracticeWords.flatMap(untokenisable)).toEqual([]);
  });
});
